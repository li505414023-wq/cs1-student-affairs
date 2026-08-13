import { randomUUID } from "node:crypto";
import { eq, and, inArray, count, getTableColumns } from "drizzle-orm";
import { getDb } from "@/db";
import { workflowInstances, workflowTasks, workflowEventLog, workflowModels, notifications, businessRecords, leaves } from "@/db/schema";
import { evaluate } from "./expression";
import { canOperateTask, isFullAccessRole, assertInstanceAccess } from "./access";
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
  async start(modelKey: string, formData: Record<string, unknown>, userId: string, recordId?: string, recordTable = "business_records"): Promise<string> {
    // Load the latest deployed model
    const [model] = await this.db
      .select()
      .from(workflowModels)
      .where(eq(workflowModels.key, modelKey))
      .limit(1);

    if (!model) throw new WorkflowError(`流程模型 "${modelKey}" 不存在`, 404);

    const nodes = (model.nodesJson as Array<Record<string, unknown>>) ?? [];
    if (nodes.length === 0) throw new WorkflowError(`流程模型 "${modelKey}" 未配置节点，无法发起`, 422);

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
      recordTable,
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

    if (!instance) throw new WorkflowError("流程实例不存在", 404);
    if (instance.status !== "运行中") throw new WorkflowError(`流程当前状态为「${instance.status}」，无法推进`, 409);

    // Row-level access check first (starter, (former) assignees, or school-wide
    // roles). Prevents unrelated users from advancing instances they cannot see.
    const instanceTasks = await this.db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.instanceId, input.instanceId));
    assertInstanceAccess(instance, instanceTasks, {
      id: input.userId,
      role: input.userRole,
      roleTags: input.userRoleTags ?? [],
    });

    // The caller must act on the node the instance is actually sitting at.
    // Accepting an arbitrary nodeId used to let attackers target start/end nodes
    // and bypass authorization entirely.
    if (input.nodeId !== instance.currentNodeId) {
      throw new WorkflowError("节点与流程当前状态不一致，请刷新后重试", 409);
    }

    // Load model nodes
    const [model] = await this.db
      .select()
      .from(workflowModels)
      .where(eq(workflowModels.key, instance.modelKey))
      .limit(1);

    const nodes = (model?.nodesJson as Array<Record<string, unknown>>) ?? [];
    const currentNode = nodes.find((n: Record<string, unknown>) => n.id === input.nodeId);

    if (!currentNode) throw new WorkflowError("流程节点不存在", 409);

    // Start/end nodes are transitioned automatically by the engine; they never
    // carry a pending task and must never be advanced manually.
    if (["start", "end"].includes(currentNode.type as string)) {
      throw new WorkflowError("开始/结束节点不能手动推进", 409);
    }

    // Authorization: a pending task must exist on the current node and the
    // operator must be allowed to work it (claimer, assignee by user/role/tag,
    // or admin). The instance starter gets no bypass — approvals require a
    // matching candidate identity.
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
    if (!pendingTask) {
      throw new WorkflowError("该节点暂无待处理任务，无法推进", 409);
    }
    if (!canOperateTask(pendingTask, { id: input.userId, role: input.userRole, roleTags: input.userRoleTags ?? [] })) {
      throw new WorkflowError("无权处理该任务", 403);
    }
    await this.completeCurrentTask(input.instanceId, input.nodeId, input);

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

    if (!instance) throw new WorkflowError("流程实例不存在", 404);
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

    if (!instance) throw new WorkflowError("流程实例不存在", 404);
    if (instance.startedBy !== userId && userRole !== "admin") {
      throw new WorkflowError("只有发起人或管理员可以撤回流程", 403);
    }

    // Status-conditioned update guards against concurrent cancel/complete races.
    // Instances returned for edits (退回待修改) may also be withdrawn by the starter
    // or an admin instead of being resubmitted.
    const updated = await this.db
      .update(workflowInstances)
      .set({ status: "已撤回", currentNodeId: null, completedAt: new Date() })
      .where(and(eq(workflowInstances.id, instanceId), inArray(workflowInstances.status, ["运行中", "退回待修改"])))
      .returning({ id: workflowInstances.id });
    if (updated.length === 0) throw new WorkflowError("流程不在可撤回状态，无法撤回", 409);

    // Close any dangling tasks so cancelled instances never leave orphaned work items.
    await this.db
      .update(workflowTasks)
      .set({ status: "已取消", completedAt: new Date() })
      .where(and(eq(workflowTasks.instanceId, instanceId), inArray(workflowTasks.status, ["待签收", "待处理"])));

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
   * Only tasks belonging to running instances are returned; tasks of cancelled or
   * finished instances are hidden so approvers never see orphaned work items.
   */
  async getTodo(userId: string, role: string, roleTags: string[] = []) {
    const taskColumns = getTableColumns(workflowTasks);
    // School-wide roles see every pending task; others match by user/role/tags
    return this.db
      .select(taskColumns)
      .from(workflowTasks)
      .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
      .where(
        and(
          eq(workflowTasks.status, "待处理"),
          eq(workflowInstances.status, "运行中"),
          ...(isFullAccessRole(role)
            ? []
            : [inArray(workflowTasks.assigneeValue, [userId, role, ...roleTags].filter(Boolean))]),
        ),
      )
      .orderBy(workflowTasks.createdAt);
  }

  /**
   * Get claimable (待签收) tasks matching the user's role or role tags.
   * Like getTodo, only tasks of running instances are surfaced.
   */
  async getClaimable(role: string, roleTags: string[] = []) {
    const taskColumns = getTableColumns(workflowTasks);
    const matchValues = isFullAccessRole(role) ? [] : [role, ...roleTags].filter(Boolean);
    if (!isFullAccessRole(role) && matchValues.length === 0) return [];
    return this.db
      .select(taskColumns)
      .from(workflowTasks)
      .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
      .where(
        and(
          eq(workflowTasks.status, "待签收"),
          eq(workflowInstances.status, "运行中"),
          ...(isFullAccessRole(role) ? [] : [inArray(workflowTasks.assigneeValue, matchValues)]),
        ),
      )
      .orderBy(workflowTasks.createdAt);
  }

  /**
   * Claim a task — assign it to the current user and move from 待签收 → 待处理.
   * Only tasks with status "待签收" can be claimed; group tasks allow any user with
   * a matching role tag to claim; personal tasks require exact assignee match.
   */
  async claimTask(taskId: string, userId: string, userRole = "", userRoleTags: string[] = []): Promise<boolean> {
    // Verify the task exists and the claimer is actually a candidate
    // (assignee value matches user id / role / role tags, or admin).
    const [task] = await this.db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.id, taskId))
      .limit(1);

    if (!task) throw new WorkflowError("任务不存在", 404);
    if (task.status !== "待签收") throw new WorkflowError("任务已被签收或已处理", 409);
    if (!canOperateTask(task, { id: userId, role: userRole, roleTags: userRoleTags })) {
      throw new WorkflowError("不属于该任务的候选处理人，无法签收", 403);
    }

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
      .select({ recordId: workflowInstances.recordId, recordTable: workflowInstances.recordTable })
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);
    if (!instance?.recordId) return;
    // 多态业务记录：请假实例的 recordId 指向领域表 leaves，其余指向 business_records。
    if (instance.recordTable === "leaves") {
      await this.db
        .update(leaves)
        .set({ status: recordStatus, updatedAt: new Date() })
        .where(eq(leaves.id, instance.recordId));
      return;
    }
    await this.db
      .update(businessRecords)
      .set({ status: recordStatus, updatedAt: new Date() })
      .where(eq(businessRecords.id, instance.recordId));
  }

  /**
   * Evaluate a condition node's expression against the instance form data.
   * Logs the outcome for the audit trail. Empty expression passes through (true).
   */
  private async evaluateCondition(instanceId: string, node: Record<string, unknown>): Promise<boolean> {
    const [instance] = await this.db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);
    const conditionExpr = node.conditionExpression as string | undefined;
    const shouldBranch = conditionExpr
      ? evaluate(conditionExpr, { formData: instance?.formDataJson as Record<string, unknown> ?? {}, user: { id: instance?.startedBy ?? "", role: "" } })
      : true;
    await this.logEvent(instanceId, node.id as string, "condition_evaluated", String(shouldBranch));
    return shouldBranch;
  }

  /** Complete the instance as passed (reached end node or ran out of nodes). */
  private async completeInstance(instanceId: string) {
    await this.db
      .update(workflowInstances)
      .set({ status: "已完成", currentNodeId: null, completedAt: new Date() })
      .where(eq(workflowInstances.id, instanceId));
    await this.logEvent(instanceId, "end", "instance_complete", "");
    await this.syncRecordStatus(instanceId, "已通过");
  }

  /**
   * Resolve the next actionable node after `fromNode`, auto-skipping submit
   * and condition nodes. Condition nodes branch by trueNodeId/falseNodeId when
   * configured, otherwise fall back to linear order. Returns null at flow end.
   * `visited` guards against cycles in branching configurations.
   */
  private async resolveNext(instanceId: string, fromNode: Record<string, unknown>, nodes: Array<Record<string, unknown>>, visited: Set<string>): Promise<Record<string, unknown> | null> {
    if (visited.has(fromNode.id as string)) return null;
    visited.add(fromNode.id as string);

    let next: Record<string, unknown> | undefined;
    if (fromNode.type === "condition") {
      const shouldBranch = await this.evaluateCondition(instanceId, fromNode);
      const targetId = (shouldBranch ? fromNode.trueNodeId : fromNode.falseNodeId) as string | undefined;
      next = targetId ? nodes.find((n) => n.id === targetId) : nodes[nodes.indexOf(fromNode) + 1];
    } else {
      next = nodes[nodes.indexOf(fromNode) + 1];
    }

    if (!next || next.type === "end") return null;
    if (next.type === "submit") {
      await this.logEvent(instanceId, next.id as string, "node_auto_submit", "");
      return this.resolveNext(instanceId, next, nodes, visited);
    }
    if (next.type === "condition") {
      return this.resolveNext(instanceId, next, nodes, visited);
    }
    return next;
  }

  private async transitionToNext(instanceId: string, currentNodeId: string, nodes: Array<Record<string, unknown>>) {
    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return;
    const next = await this.resolveNext(instanceId, currentNode, nodes, new Set());
    if (!next) {
      await this.completeInstance(instanceId);
      return;
    }
    await this.activateNextNode(instanceId, next);
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
