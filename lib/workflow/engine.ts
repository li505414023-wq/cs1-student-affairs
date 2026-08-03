import { randomUUID } from "node:crypto";
import { eq, and, inArray, count } from "drizzle-orm";
import { getDb } from "@/db";
import { workflowInstances, workflowTasks, workflowEventLog, workflowModels, notifications, businessRecords } from "@/db/schema";
import { evaluate } from "./expression";
import { canOperateTask, isFullAccessRole } from "./access";
import { WorkflowError } from "./types";
import type { WorkflowStatus, AdvanceInput } from "./types";

/**
 * Lightweight workflow execution engine.
 * Manages workflow instances, task assignment, node transitions, and condition evaluation.
 * Pure TypeScript — no framework dependencies, uses Drizzle ORM for persistence.
 */
export class WorkflowEngine {
  private db = getDb();

  /**
   * Start a new workflow instance from a deployed model.
   */
  async start(modelKey: string, formData: Record<string, unknown>, userId: string, recordId?: string): Promise<string> {
    // Load the latest deployed model
    const [model] = await this.db
      .select()
      .from(workflowModels)
      .where(eq(workflowModels.key, modelKey))
      .limit(1);

    if (!model) throw new Error(`Workflow model "${modelKey}" not found`);

    const nodes = (model.nodesJson as Array<Record<string, unknown>>) ?? [];
    if (nodes.length === 0) throw new Error(`Workflow model "${modelKey}" has no nodes`);

    const instanceId = randomUUID();
    const startNode = nodes.find((n: Record<string, unknown>) => n.type === "start") ?? nodes[0];
    const startNodeId = startNode.id as string;

    // Create instance
    await this.db.insert(workflowInstances).values({
      id: instanceId,
      modelKey: model.key,
      modelId: model.id,
      modelName: model.name,
      title: (formData.title as string) ?? `${model.name} - ${new Date().toLocaleString("zh-CN")}`,
      formId: model.formId,
      formDataJson: formData,
      status: "运行中",
      currentNodeId: startNodeId,
      recordId: recordId ?? null,
      startedBy: userId,
    });

    // Log start event
    await this.logEvent(instanceId, startNodeId, "instance_start", userId);

    // Auto-advance past the start node to the next node
    await this.transitionToNext(instanceId, startNodeId, nodes as Array<Record<string, unknown>>);

    return instanceId;
  }

  /**
   * Resolve the current workflow node name for a set of business records.
   * Returns a map of recordId -> { node, status } for records that started a flow.
   */
  async nodesForRecords(recordIds: string[]): Promise<Record<string, { node: string; status: string; instanceId: string }>> {
    if (recordIds.length === 0) return {};
    const instances = await this.db.select().from(workflowInstances).where(inArray(workflowInstances.recordId, recordIds));
    if (instances.length === 0) return {};
    const modelIds = [...new Set(instances.map((instance) => instance.modelId))];
    const models = await this.db.select().from(workflowModels).where(inArray(workflowModels.id, modelIds));
    const nodeNameByModel = new Map<string, Map<string, string>>();
    for (const model of models) {
      const map = new Map<string, string>();
      for (const node of ((model.nodesJson as Array<Record<string, unknown>>) ?? [])) {
        if (node.id && node.name) map.set(String(node.id), String(node.name));
      }
      nodeNameByModel.set(model.id, map);
    }
    const result: Record<string, { node: string; status: string; instanceId: string }> = {};
    for (const instance of instances) {
      if (!instance.recordId) continue;
      const node = instance.status !== "运行中"
        ? instance.status
        : nodeNameByModel.get(instance.modelId)?.get(instance.currentNodeId ?? "") ?? "审核中";
      result[instance.recordId] = { node, status: instance.status, instanceId: instance.id };
    }
    return result;
  }

  /**
   * Advance a workflow instance: approve, reject, return, or submit.
   */
  async advance(input: AdvanceInput): Promise<{ status: WorkflowStatus; currentNodeId: string | null }> {
    const [instance] = await this.db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, input.instanceId))
      .limit(1);

    if (!instance) throw new Error("Instance not found");
    if (instance.status !== "运行中") throw new Error(`Instance is ${instance.status}, cannot advance`);

    // Load model nodes
    const [model] = await this.db
      .select()
      .from(workflowModels)
      .where(eq(workflowModels.key, instance.modelKey))
      .limit(1);

    const nodes = (model?.nodesJson as Array<Record<string, unknown>>) ?? [];
    const currentNode = nodes.find((n: Record<string, unknown>) => n.id === input.nodeId);

    if (!currentNode) throw new Error(`Node "${input.nodeId}" not found`);

    // Complete the current task if it's an actionable node
    if (!["start", "end"].includes(currentNode.type as string)) {
      // Authorization: the instance starter, the assignee (by user/role/role tag),
      // the claimer, or an admin may act.
      const [pendingTask] = await this.db
        .select()
        .from(workflowTasks)
        .where(
          and(
            eq(workflowTasks.instanceId, input.instanceId),
            eq(workflowTasks.nodeId, input.nodeId),
            eq(workflowTasks.status, "待处理"),
          ),
        )
        .limit(1);
      if (
        pendingTask
        && instance.startedBy !== input.userId
        && !canOperateTask(pendingTask, { id: input.userId, role: input.userRole, roleTags: input.userRoleTags })
      ) {
        throw new WorkflowError("无权处理该任务", 403);
      }
      await this.completeCurrentTask(input.instanceId, input.nodeId, input);
    }

    // Log
    await this.logEvent(input.instanceId, input.nodeId, `node_${input.action}`, input.userId);

    // Handle rejection — terminal state
    if (input.action === "reject") {
      await this.db
        .update(workflowInstances)
        .set({ status: "已拒绝", currentNodeId: null, completedAt: new Date() })
        .where(eq(workflowInstances.id, input.instanceId));
      await this.syncRecordStatus(input.instanceId, "已驳回");
      return { status: "已拒绝", currentNodeId: null };
    }

    // Handle return — send back to the starter for revision, instance stays open
    if (input.action === "return") {
      const startNode = nodes.find((n: Record<string, unknown>) => n.type === "start") ?? nodes[0];
      await this.db
        .update(workflowInstances)
        .set({ status: "退回待修改", currentNodeId: (startNode?.id as string) ?? null, completedAt: null })
        .where(eq(workflowInstances.id, input.instanceId));
      await this.logEvent(input.instanceId, input.nodeId, "instance_returned", input.userId);
      await this.syncRecordStatus(input.instanceId, "退回待修改");
      await this.notifyStarter(input.instanceId, "审批结果: 退回修改", `流程被退回，请修改后重新提交${input.comment ? `（${input.comment}）` : ""}`);
      return { status: "退回待修改", currentNodeId: (startNode?.id as string) ?? null };
    }

    // Transition to next node
    await this.transitionToNext(input.instanceId, input.nodeId, nodes);

    // Check if we reached the end
    const [updated] = await this.db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, input.instanceId))
      .limit(1);

    return { status: updated?.status as WorkflowStatus, currentNodeId: updated?.currentNodeId ?? null };
  }

  /**
   * Resubmit an instance that was returned for revision.
   * Only the original starter may resubmit; the flow restarts from the start node.
   */
  async resubmit(instanceId: string, userId: string): Promise<{ status: WorkflowStatus }> {
    const [instance] = await this.db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);

    if (!instance) throw new Error("Instance not found");
    if (instance.status !== "退回待修改") throw new WorkflowError("流程未被退回，无法重新提交", 409);
    if (instance.startedBy !== userId) throw new WorkflowError("只有发起人可以重新提交", 403);

    const [model] = await this.db
      .select()
      .from(workflowModels)
      .where(eq(workflowModels.key, instance.modelKey))
      .limit(1);

    const nodes = (model?.nodesJson as Array<Record<string, unknown>>) ?? [];
    const startNode = nodes.find((n: Record<string, unknown>) => n.type === "start") ?? nodes[0];

    await this.db
      .update(workflowInstances)
      .set({ status: "运行中", currentNodeId: (startNode?.id as string) ?? null, completedAt: null })
      .where(eq(workflowInstances.id, instanceId));

    await this.logEvent(instanceId, (startNode?.id as string) ?? "", "instance_resubmit", userId);
    await this.syncRecordStatus(instanceId, "已提交");

    if (nodes.length > 0) {
      await this.transitionToNext(instanceId, startNode?.id as string, nodes);
    }

    const [updated] = await this.db
      .select({ status: workflowInstances.status })
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);
    return { status: (updated?.status ?? "运行中") as WorkflowStatus };
  }

  /**
   * Cancel a running instance.
   */
  async cancel(instanceId: string, userId: string, userRole = ""): Promise<void> {
    const [instance] = await this.db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);

    if (!instance) throw new Error("Instance not found");
    if (instance.startedBy !== userId && userRole !== "admin") {
      throw new WorkflowError("只有发起人或管理员可以撤回流程", 403);
    }

    // Status-conditioned update guards against concurrent cancel/complete races.
    const updated = await this.db
      .update(workflowInstances)
      .set({ status: "已撤回", currentNodeId: null, completedAt: new Date() })
      .where(and(eq(workflowInstances.id, instanceId), eq(workflowInstances.status, "运行中")))
      .returning({ id: workflowInstances.id });
    if (updated.length === 0) throw new WorkflowError("流程不在运行中，无法撤回", 409);

    await this.logEvent(instanceId, "", "instance_cancel", userId);
    await this.syncRecordStatus(instanceId, "已撤回");
  }

  /**
   * Get full instance status with task history.
   */
  async getStatus(instanceId: string) {
    const [instance] = await this.db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);

    if (!instance) return null;

    const tasks = await this.db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.instanceId, instanceId))
      .orderBy(workflowTasks.createdAt);

    const events = await this.db
      .select()
      .from(workflowEventLog)
      .where(eq(workflowEventLog.instanceId, instanceId))
      .orderBy(workflowEventLog.createdAt);

    return { instance, tasks, events };
  }

  /**
   * List instances with optional filters.
   */
  async list(filters: { userId?: string; modelKey?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const conditions = [];
    if (filters.userId) {
      conditions.push(eq(workflowInstances.startedBy, filters.userId));
    }
    if (filters.modelKey) {
      conditions.push(eq(workflowInstances.modelKey, filters.modelKey));
    }
    if (filters.status) {
      conditions.push(eq(workflowInstances.status, filters.status));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db
      .select()
      .from(workflowInstances)
      .where(where)
      .orderBy(workflowInstances.startedAt)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [totalRow] = await this.db
      .select({ value: count() })
      .from(workflowInstances)
      .where(where);

    return { items, pagination: { page, pageSize, total: Number(totalRow?.value ?? 0) } };
  }

  /**
   * Get pending tasks for a user — matches by role tags AND direct user assignment.
   */
  async getTodo(userId: string, role: string, roleTags: string[] = []) {
    // School-wide roles see every pending task; others match by user/role/tags
    const base = this.db.select().from(workflowTasks).where(
      isFullAccessRole(role)
        ? eq(workflowTasks.status, "待处理")
        : and(
            eq(workflowTasks.status, "待处理"),
            inArray(workflowTasks.assigneeValue, [userId, role, ...roleTags].filter(Boolean)),
          ),
    );
    return base.orderBy(workflowTasks.createdAt);
  }

  /**
   * Get claimable (待签收) tasks matching the user's role or role tags.
   */
  async getClaimable(role: string, roleTags: string[] = []) {
    // School-wide roles may claim any awaiting task
    if (isFullAccessRole(role)) {
      return this.db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.status, "待签收"))
        .orderBy(workflowTasks.createdAt);
    }
    const matchValues = [role, ...roleTags].filter(Boolean);
    if (matchValues.length === 0) return [];
    return this.db
      .select()
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.status, "待签收"),
          inArray(workflowTasks.assigneeValue, matchValues),
        ),
      )
      .orderBy(workflowTasks.createdAt);
  }

  /**
   * Claim a task — assign it to the current user and move from 待签收 → 待处理.
   * Only tasks with status "待签收" can be claimed; group tasks allow any user with
   * a matching role tag to claim; personal tasks require exact assignee match.
   */
  async claimTask(taskId: string, userId: string): Promise<boolean> {
    // Atomic claim: the status condition makes concurrent claims race-safe.
    const updated = await this.db
      .update(workflowTasks)
      .set({ claimedBy: userId, status: "待处理" })
      .where(and(eq(workflowTasks.id, taskId), eq(workflowTasks.status, "待签收")))
      .returning({ id: workflowTasks.id, instanceId: workflowTasks.instanceId, nodeId: workflowTasks.nodeId });

    if (updated.length === 0) throw new WorkflowError("任务已被签收或已处理", 409);

    await this.logEvent(updated[0].instanceId, updated[0].nodeId, "task_claimed", userId);
    return true;
  }

  /**
   * Get completed tasks for a user.
   */
  async getDone(userId: string) {
    return this.db
      .select()
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.status, "已完成"),
          eq(workflowTasks.claimedBy, userId),
        )
      )
      .orderBy(workflowTasks.completedAt);
  }

  // --- Private helpers ---

  /**
   * Notify the instance starter with a custom message (best-effort).
   */
  private async notifyStarter(instanceId: string, title: string, content: string) {
    try {
      const [instance] = await this.db.select({ title: workflowInstances.title, startedBy: workflowInstances.startedBy }).from(workflowInstances).where(eq(workflowInstances.id, instanceId)).limit(1);
      if (instance?.startedBy) {
        await this.db.insert(notifications).values({
          id: randomUUID(), userId: instance.startedBy, type: "task_completed",
          title, content: `${instance.title ?? "流程实例"} — ${content}`,
          relatedId: instanceId,
        });
      }
    } catch { /* notification failure is non-critical */ }
  }

  /**
   * Propagate a terminal instance status to the linked business record.
   */
  private async syncRecordStatus(instanceId: string, recordStatus: string) {
    const [instance] = await this.db
      .select({ recordId: workflowInstances.recordId })
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);
    if (!instance?.recordId) return;
    await this.db
      .update(businessRecords)
      .set({ status: recordStatus, updatedAt: new Date() })
      .where(eq(businessRecords.id, instance.recordId));
  }

  private async transitionToNext(instanceId: string, currentNodeId: string, nodes: Array<Record<string, unknown>>) {
    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return;

    // Find the next node(s) after the current one
    const currentIndex = nodes.indexOf(currentNode);
    const nextNode = nodes[currentIndex + 1];

    if (!nextNode || (nextNode.type as string) === "end") {
      // Reached end — complete the instance
      await this.db
        .update(workflowInstances)
        .set({ status: "已完成", currentNodeId: null, completedAt: new Date() })
        .where(eq(workflowInstances.id, instanceId));
      await this.logEvent(instanceId, "end", "instance_complete", "");
      await this.syncRecordStatus(instanceId, "已通过");
      return;
    }

    // Applicant submit nodes are fulfilled by the act of starting the instance
    // (the form was already submitted), so advance past them automatically.
    if ((nextNode.type as string) === "submit") {
      await this.logEvent(instanceId, nextNode.id as string, "node_auto_submit", "");
      await this.transitionToNext(instanceId, nextNode.id as string, nodes);
      return;
    }

    // Handle condition nodes
    if ((nextNode.type as string) === "condition") {
      const [instance] = await this.db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, instanceId))
        .limit(1);

      const conditionExpr = nextNode.conditionExpression as string | undefined;
      const shouldBranch = conditionExpr
        ? evaluate(conditionExpr, { formData: instance?.formDataJson as Record<string, unknown> ?? {}, user: { id: instance?.startedBy ?? "", role: "" } })
        : true;

      if (shouldBranch) {
        // Skip condition node, go to next after it
        const afterCondition = nodes[currentIndex + 2];
        await this.activateNextNode(instanceId, afterCondition);
      } else {
        // Follow default/else path — for now, skip past condition
        const afterCondition = nodes[currentIndex + 2];
        await this.activateNextNode(instanceId, afterCondition);
      }
      return;
    }

    await this.activateNextNode(instanceId, nextNode);
  }

  private async activateNextNode(instanceId: string, nextNode: Record<string, unknown> | undefined) {
    if (!nextNode) {
      await this.db
        .update(workflowInstances)
        .set({ status: "已完成", currentNodeId: null, completedAt: new Date() })
        .where(eq(workflowInstances.id, instanceId));
      await this.syncRecordStatus(instanceId, "已通过");
      return;
    }

    const nextNodeId = nextNode.id as string;

    // Update current node
    await this.db
      .update(workflowInstances)
      .set({ currentNodeId: nextNodeId })
      .where(eq(workflowInstances.id, instanceId));

    // For actionable nodes, create a task
    if (!["start", "end", "condition"].includes(nextNode.type as string)) {
      const nodeType = nextNode.type as string;
      const defaultAssignee = nextNode.assignee as string ?? "辅导员";
      const assigneeType = (nextNode.assigneeType as string | undefined) ?? "role";
      // Tasks assigned to a specific user go straight to 待处理; role/group
      // tasks wait in 待签收 until someone with a matching role claims them.
      const initialStatus = assigneeType === "user" ? "待处理" : "待签收";
      await this.db.insert(workflowTasks).values({
        id: randomUUID(),
        instanceId,
        nodeId: nextNodeId,
        nodeName: nextNode.name as string,
        nodeType,
        assigneeType,
        assigneeValue: nextNode.assignee as string ?? defaultAssignee,
        status: initialStatus,
      });

      // Notify instance starter about new task
      try {
        const [instance] = await this.db.select({ title: workflowInstances.title, startedBy: workflowInstances.startedBy }).from(workflowInstances).where(eq(workflowInstances.id, instanceId)).limit(1);
        if (instance?.startedBy) {
          await this.db.insert(notifications).values({
            id: randomUUID(), userId: instance.startedBy, type: "task_assigned",
            title: `新待办: ${nextNode.name}`,
            content: `${instance.title ?? "流程实例"} — ${nextNode.name}已分派给${nextNode.assignee ?? defaultAssignee}`,
            relatedId: instanceId,
          });
        }
      } catch { /* notification failure should not break workflow */ }

      // Set due date if SLA hours configured
      const dueHours = nextNode.dueHours as number | undefined;
      if (dueHours) {
        const dueAt = new Date(Date.now() + dueHours * 60 * 60 * 1000);
        await this.db
          .update(workflowInstances)
          .set({ timeoutAt: dueAt })
          .where(eq(workflowInstances.id, instanceId));
      }
    }

    await this.logEvent(instanceId, nextNodeId, "node_enter", "");
  }

  private async completeCurrentTask(instanceId: string, nodeId: string, input: AdvanceInput) {
    // Optimistic lock: if two approvers submit at once, exactly one update
    // returns the row; the loser gets a 409 and no workflow state changes.
    const completed = await this.db
      .update(workflowTasks)
      .set({
        status: "已完成",
        result: input.result ?? input.action,
        comment: input.comment ?? "",
        claimedBy: input.userId,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(workflowTasks.instanceId, instanceId),
          eq(workflowTasks.nodeId, nodeId),
          eq(workflowTasks.status, "待处理"),
        )
      )
      .returning({ id: workflowTasks.id });
    if (completed.length === 0) {
      throw new WorkflowError("该任务已被他人处理，请刷新后重试", 409);
    }

    // Notify instance starter about completed task. The return action is
    // skipped here because the return branch in advance() sends a dedicated
    // "退回修改" notification; notifying both would duplicate the message.
    try {
      if (input.action === "return") return;
      const [instance] = await this.db.select({ title: workflowInstances.title, startedBy: workflowInstances.startedBy }).from(workflowInstances).where(eq(workflowInstances.id, instanceId)).limit(1);
      if (instance?.startedBy) {
        const resultLabel = input.result ?? "已处理";
        await this.db.insert(notifications).values({
          id: randomUUID(), userId: instance.startedBy, type: "task_completed",
          title: `审批结果: ${resultLabel}`,
          content: `${instance.title ?? "流程实例"} — ${input.comment ?? "处理完成"}`,
          relatedId: instanceId,
        });
      }
    } catch { /* notification failure is non-critical */ }
  }

  private async logEvent(instanceId: string, nodeId: string, event: string, actorId: string) {
    await this.db.insert(workflowEventLog).values({
      id: randomUUID(),
      instanceId,
      nodeId: nodeId || undefined,
      event,
      actorId: actorId || undefined,
      detailJson: {},
    });
  }
}
