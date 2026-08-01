import type { NextRequest } from "next/server";
import { WorkflowEngine } from "@/lib/workflow/engine";
import { isFullAccessRole } from "@/lib/workflow/access";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

const engine = new WorkflowEngine();

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    const body = await readJson(request);
    const modelKey = typeof body?.modelKey === "string" ? body.modelKey.trim() : "";
    if (!modelKey) throw new ApiError(422, "请指定流程模型");
    const formData = (body?.formData as Record<string, unknown>) ?? {};
    const instanceId = await engine.start(modelKey, formData, session.user.id);
    await writeAudit({ userId: session.user.id, action: "start_workflow", resourceType: "workflow_instance", resourceId: instanceId, ip: requestIp(request) });
    return ok({ instanceId }, 201);
  } catch (error) {
    return fail(error, request);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const modelKey = url.searchParams.get("modelKey") ?? undefined;
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
    // Data scope: only school-wide roles may query other users' instances
    const requestedUserId = url.searchParams.get("userId") ?? undefined;
    const userId = isFullAccessRole(session.user.role) ? requestedUserId : session.user.id;
    const result = await engine.list({ userId, modelKey, status, page, pageSize });
    return ok(result);
  } catch (error) {
    return fail(error, request);
  }
}
