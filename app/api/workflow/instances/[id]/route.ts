import type { NextRequest } from "next/server";
import { WorkflowEngine } from "@/lib/workflow/engine";
import { assertInstanceAccess } from "@/lib/workflow/access";
import { WorkflowError } from "@/lib/workflow/types";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, writeAudit, requestIp } from "@/lib/api";

export const runtime = "nodejs";

const engine = new WorkflowEngine();

function failWithWorkflowErrors(error: unknown, request?: Request) {
  if (error instanceof WorkflowError) return fail(new ApiError(error.status, error.message), request);
  return fail(error, request);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(_request, "read");
    const { id } = await context.params;
    const detail = await engine.getStatus(id);
    if (!detail) throw new ApiError(404, "流程实例不存在");
    // Row-level authorization: starter, (former) assignees, or school-wide roles only
    assertInstanceAccess(detail.instance, detail.tasks, session.user);
    return ok(detail);
  } catch (error) {
    return fail(error, _request);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    const { id } = await context.params;
    const body = await readJson(request);
    const action = (body?.action as string) ?? "advance";
    if (action === "resubmit") {
      const result = await engine.resubmit(id, session.user.id);
      await writeAudit({ userId: session.user.id, action: "resubmit_workflow", resourceType: "workflow_instance", resourceId: id, ip: requestIp(request) });
      return ok(result);
    }
    const result = await engine.advance({
      instanceId: id,
      nodeId: String(body?.nodeId ?? ""),
      action: action as "approve" | "reject" | "return" | "submit",
      userId: session.user.id,
      userRole: session.user.role,
      userRoleTags: session.user.roleTags,
      comment: typeof body?.comment === "string" ? body.comment : "",
      result: typeof body?.result === "string" ? body.result as "同意" | "退回" | "拒绝" : undefined,
    });
    await writeAudit({ userId: session.user.id, action: "advance_workflow", resourceType: "workflow_instance", resourceId: id, detail: { nodeId: body?.nodeId, action, result }, ip: requestIp(request) });
    return ok(result);
  } catch (error) {
    return failWithWorkflowErrors(error, request);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    const { id } = await context.params;
    await engine.cancel(id, session.user.id, session.user.role);
    await writeAudit({ userId: session.user.id, action: "cancel_workflow", resourceType: "workflow_instance", resourceId: id, ip: requestIp(request) });
    return ok({ cancelled: true });
  } catch (error) {
    return failWithWorkflowErrors(error, request);
  }
}
