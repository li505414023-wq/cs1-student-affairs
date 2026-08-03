import { and, count, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { businessRecords } from "@/db/schema";
import { getCurrentSession, requirePermission, validateCsrf } from "@/lib/auth";
import { hasPermission } from "@/lib/security";
import { WorkflowEngine } from "@/lib/workflow/engine";
import { isStudentApplyFeature, modelKeyForFeature } from "@/lib/feature-policy";
import { recordScopeConditions } from "@/lib/records-scope";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { validateRecordInput } from "@/lib/validation";

export const runtime = "nodejs";

function validFeatureId(value: string) {
  if (!/^[a-z0-9-]{2,80}$/i.test(value)) throw new ApiError(400, "功能标识不正确");
  return value;
}

export async function GET(request: NextRequest, context: { params: Promise<{ featureId: string }> }) {
  try {
    const session = await requirePermission(request, "read");
    const { featureId: raw } = await context.params;
    const featureId = validFeatureId(raw);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
    const db = getDb();
    const conditions = [eq(businessRecords.featureId, featureId), ...(await recordScopeConditions(session))];
    const where = and(...conditions);
    const records = await db.select().from(businessRecords).where(where).orderBy(desc(businessRecords.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
    const [totalRow] = await db.select({ value: count() }).from(businessRecords).where(where);
    const workflowByRecord = await new WorkflowEngine().nodesForRecords(records.map((record) => record.id));
    const items = records.map((record) => ({ ...record, data: record.dataJson, dataJson: undefined, workflow: workflowByRecord[record.id] ?? null }));
    return ok({ items, pagination: { page, pageSize, total: Number(totalRow?.value ?? 0) } });
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ featureId: string }> }) {
  try {
    const session = await getCurrentSession(request);
    if (!session) throw new ApiError(401, "请先登录");
    const { featureId: raw } = await context.params;
    const featureId = validFeatureId(raw);

    // Students may only submit whitelisted application features; other roles need write.
    const studentApply = session.user.role === "student" && isStudentApplyFeature(featureId);
    if (session.user.role === "student" && !studentApply) {
      throw new ApiError(403, "学生账号只能提交申请类业务");
    }
    if (!studentApply && !(await hasPermission(session.user.role, "write"))) {
      throw new ApiError(403, "当前账号没有此操作权限");
    }
    validateCsrf(request, session);

    const validated = validateRecordInput(await readJson(request));
    if (!validated.success) throw new ApiError(422, "业务数据校验失败", validated.errors);
    const id = randomUUID();
    const status = studentApply ? "已提交" : validated.data.status;
    await getDb().insert(businessRecords).values({ id, featureId, dataJson: validated.data.data, status, createdBy: session.user.id });
    await writeAudit({ userId: session.user.id, action: "create", resourceType: featureId, resourceId: id, ip: requestIp(request) });

    // Student applications start the matching approval flow when a model exists.
    let instanceId: string | null = null;
    if (studentApply) {
      try {
        instanceId = await new WorkflowEngine().start(
          modelKeyForFeature(featureId),
          { ...validated.data.data, applicant: session.user.displayName },
          session.user.id,
          id,
        );
        await writeAudit({ userId: session.user.id, action: "start_workflow", resourceType: "workflow_instance", resourceId: instanceId, detail: { featureId }, ip: requestIp(request) });
      } catch {
        // No deployed model for this feature — keep the record without a flow.
        instanceId = null;
      }
    }

    return ok({ id, featureId, status, data: validated.data.data, instanceId }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
