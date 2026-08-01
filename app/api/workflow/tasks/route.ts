import { inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { workflowInstances } from "@/db/schema";
import { WorkflowEngine } from "@/lib/workflow/engine";
import { WorkflowError } from "@/lib/workflow/types";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, writeAudit, requestIp } from "@/lib/api";

export const runtime = "nodejs";

const engine = new WorkflowEngine();

type TaskRow = {
  id: string;
  instanceId: string;
  nodeId: string;
  nodeName: string | null;
  nodeType: string | null;
  assigneeType: string | null;
  assigneeValue: string | null;
  status: string | null;
  claimedBy: string | null;
  result: string | null;
  comment: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

/** Attach instance title/status/starter to each task so lists can render without N+1 fetches. */
async function enrichTasks(tasks: TaskRow[]) {
  const instanceIds = [...new Set(tasks.map((task) => task.instanceId))];
  if (instanceIds.length === 0) return [];
  const instances = await getDb()
    .select({
      id: workflowInstances.id,
      title: workflowInstances.title,
      status: workflowInstances.status,
      startedBy: workflowInstances.startedBy,
    })
    .from(workflowInstances)
    .where(inArray(workflowInstances.id, instanceIds));
  const byId = new Map(instances.map((row) => [row.id, row]));
  return tasks.map((task) => {
    const instance = byId.get(task.instanceId);
    return {
      ...task,
      instanceTitle: instance?.title ?? "",
      instanceStatus: instance?.status ?? "",
      instanceStartedBy: instance?.startedBy ?? null,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "todo";

    if (type === "done") {
      return ok({ tasks: await enrichTasks(await engine.getDone(session.user.id) as TaskRow[]) });
    }
    if (type === "claim") {
      return ok({ tasks: await enrichTasks(await engine.getClaimable(session.user.role, session.user.roleTags ?? []) as TaskRow[]) });
    }

    const tasks = await engine.getTodo(session.user.id, session.user.role, session.user.roleTags ?? []);
    return ok({ tasks: await enrichTasks(tasks as TaskRow[]) });
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    const body = await readJson(request);
    const taskId = typeof body?.taskId === "string" ? body.taskId : "";
    if (!taskId) throw new ApiError(422, "任务ID不能为空");

    const action = typeof body?.action === "string" ? body.action : "";
    if (action === "claim") {
      await engine.claimTask(taskId, session.user.id);
      await writeAudit({ userId: session.user.id, action: "claim_task", resourceType: "workflow_task", resourceId: taskId, ip: requestIp(request) });
      return ok({ claimed: true });
    }

    throw new ApiError(422, "不支持的操作，请使用 /api/workflow/instances/[id] 推进流程");
  } catch (error) {
    if (error instanceof WorkflowError) return fail(new ApiError(error.status, error.message), request);
    return fail(error, request);
  }
}
