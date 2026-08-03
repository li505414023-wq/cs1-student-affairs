import { and, count, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { businessRecords, workflowInstances } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { validateRecordInput } from "@/lib/validation";

export const runtime = "nodejs";

function validFeatureId(value: string) {
  if (!/^[a-z0-9-]{2,80}$/i.test(value)) throw new ApiError(400, "功能标识不正确");
  return value;
}

async function loadRecord(featureId: string, id: string) {
  const [record] = await getDb().select().from(businessRecords)
    .where(and(eq(businessRecords.id, id), eq(businessRecords.featureId, featureId))).limit(1);
  if (!record) throw new ApiError(404, "记录不存在");
  return record;
}

// 正在审批中的记录不允许直接改删，避免流程与数据脱节。
async function assertNoRunningInstance(recordId: string) {
  const [row] = await getDb().select({ value: count() }).from(workflowInstances)
    .where(and(eq(workflowInstances.recordId, recordId), eq(workflowInstances.status, "运行中")));
  if (Number(row?.value ?? 0) > 0) throw new ApiError(409, "该记录正在审批流程中，请先结束或撤回流程");
}

export async function PUT(request: NextRequest, context: { params: Promise<{ featureId: string; id: string }> }) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    const { featureId: raw, id } = await context.params;
    const featureId = validFeatureId(raw);
    const record = await loadRecord(featureId, id);
    await assertNoRunningInstance(id);

    const validated = validateRecordInput(await readJson(request));
    if (!validated.success) throw new ApiError(422, "业务数据校验失败", validated.errors);

    await getDb().update(businessRecords).set({ dataJson: validated.data.data, status: validated.data.status })
      .where(eq(businessRecords.id, id));
    await writeAudit({ userId: session.user.id, action: "update", resourceType: featureId, resourceId: id, ip: requestIp(request) });
    return ok({ id, featureId, status: validated.data.status, data: validated.data.data });
  } catch (error) {
    return fail(error, request);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ featureId: string; id: string }> }) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    const { featureId: raw, id } = await context.params;
    const featureId = validFeatureId(raw);
    await loadRecord(featureId, id);
    await assertNoRunningInstance(id);

    await getDb().delete(businessRecords).where(eq(businessRecords.id, id));
    await writeAudit({ userId: session.user.id, action: "delete", resourceType: featureId, resourceId: id, ip: requestIp(request) });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error, request);
  }
}
