import { and, count, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { businessRecords, workflowInstances } from "@/db/schema";
import { getCurrentSession, validateCsrf } from "@/lib/auth";
import type { CurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/security";
import { isStudentApplyFeature } from "@/lib/feature-policy";
import { recordScopeConditions } from "@/lib/records-scope";
import { canWriteFeatureStage } from "@/app/menu-policy";
import { TERMINAL_WORKFLOW_STATUSES } from "@/lib/workflow/types";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { validateRecordInput } from "@/lib/validation";
import { domainDelete, domainGet, domainUpdate, getDomainConfig } from "@/lib/domains";

export const runtime = "nodejs";

function validFeatureId(value: string) {
  if (!/^[a-z0-9-]{2,80}$/i.test(value)) throw new ApiError(400, "功能标识不正确");
  return value;
}

/**
 * 权限闸门与创建接口保持一致：学生无需 write 权限即可改删本人申请类业务
 * （退回待修改后重新编辑的场景），其余角色须具备 write 权限。
 */
async function requireWriteSession(request: NextRequest, featureId: string) {
  const session = await getCurrentSession(request);
  if (!session) throw new ApiError(401, "请先登录");
  const studentApply = session.user.role === "student" && isStudentApplyFeature(featureId);
  if (session.user.role === "student" && !studentApply) {
    throw new ApiError(403, "学生账号只能操作申请类业务");
  }
  if (!studentApply && !(await hasPermission(session.user.role, "write"))) {
    throw new ApiError(403, "当前账号没有此操作权限");
  }
  // 与创建接口一致：业务系统 config/batch 记录仅 admin 可修改/删除。
  if (!canWriteFeatureStage(featureId, session.user.role)) {
    throw new ApiError(403, "配置与批次数据仅管理员可维护");
  }
  validateCsrf(request, session);
  return session;
}

/**
 * 行级数据范围校验（与列表接口的 recordScopeConditions 一致），防止越权改删：
 * - 学生只能操作本人提交的申请记录（管理员代为登记的操行分/处分等记录不可改）；
 * - 辅导员/院系管理员只能操作本人数据范围内的记录；
 * - 管理员不受范围限制。
 * 范围外返回 403，记录不存在返回 404。
 */
async function loadRecordInScope(session: CurrentSession, featureId: string, id: string) {
  const db = getDb();
  const [record] = await db.select().from(businessRecords)
    .where(and(eq(businessRecords.id, id), eq(businessRecords.featureId, featureId))).limit(1);
  if (!record) throw new ApiError(404, "记录不存在");
  if (session.user.role === "student") {
    if (record.createdBy !== session.user.id) throw new ApiError(403, "无权操作该记录");
    return record;
  }
  const scope = await recordScopeConditions(session);
  if (scope.length > 0) {
    const [inScope] = await db.select({ id: businessRecords.id }).from(businessRecords)
      .where(and(eq(businessRecords.id, id), ...scope)).limit(1);
    if (!inScope) throw new ApiError(403, "无权操作该记录");
  }
  return record;
}

/**
 * 审批状态保护（业务记录改删需校验审批状态）：
 * - 存在"运行中"实例时任何人都不能直接改删，避免流程与数据脱节；
 * - 存在"退回待修改"实例时仅申请人（及管理员）可改删，防止他人改写流转中的记录；
 * - 存在终态实例（已完成/已拒绝/已撤回）时学生不得改删，防止自我推翻审批结论，管理员不受限。
 */
async function assertWorkflowEditable(recordId: string, createdBy: string | null, session: CurrentSession) {
  const db = getDb();
  const [row] = await db.select({ value: count() }).from(workflowInstances)
    .where(and(eq(workflowInstances.recordId, recordId), eq(workflowInstances.status, "运行中")));
  if (Number(row?.value ?? 0) > 0) throw new ApiError(409, "该记录正在审批流程中，请先结束或撤回流程");
  const [returned] = await db.select({ startedBy: workflowInstances.startedBy }).from(workflowInstances)
    .where(and(eq(workflowInstances.recordId, recordId), eq(workflowInstances.status, "退回待修改"))).limit(1);
  if (returned && session.user.role !== "admin" && returned.startedBy !== session.user.id && createdBy !== session.user.id) {
    throw new ApiError(403, "该记录已被审批流程退回待修改，仅申请人可以修改");
  }
  if (session.user.role === "student") {
    const [terminal] = await db.select({ value: count() }).from(workflowInstances)
      .where(and(eq(workflowInstances.recordId, recordId), inArray(workflowInstances.status, TERMINAL_WORKFLOW_STATUSES)));
    if (Number(terminal?.value ?? 0) > 0) throw new ApiError(403, "该记录的审批流程已完结，不能再修改或删除");
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ featureId: string; id: string }> }) {
  try {
    const { featureId: raw, id } = await context.params;
    const featureId = validFeatureId(raw);
    const session = await requireWriteSession(request, featureId);
    const domainConfig = getDomainConfig(featureId);
    if (domainConfig) {
      const existing = await domainGet(domainConfig, session, id);
      if (featureId === "leave") {
        await assertWorkflowEditable(id, existing.createdBy, session);
      }
      const validated = validateRecordInput(await readJson(request));
      if (!validated.success) throw new ApiError(422, "业务数据校验失败", validated.errors);
      const status = session.user.role === "student" && isStudentApplyFeature(featureId) ? "已提交" : validated.data.status;
      await domainUpdate(domainConfig, id, validated.data.data as Record<string, unknown>, status);
      await writeAudit({ userId: session.user.id, action: "update", resourceType: featureId, resourceId: id, ip: requestIp(request) });
      return ok({ id, featureId, status, data: validated.data.data });
    }
    const record = await loadRecordInScope(session, featureId, id);
    await assertWorkflowEditable(id, record.createdBy, session);

    const validated = validateRecordInput(await readJson(request));
    if (!validated.success) throw new ApiError(422, "业务数据校验失败", validated.errors);

    // 对齐 POST 语义：学生对本人申请类 feature 不能自定审批状态，强制"已提交"，防止自我批准。
    const studentApply = session.user.role === "student" && isStudentApplyFeature(featureId);
    const status = studentApply ? "已提交" : validated.data.status;
    await getDb().update(businessRecords).set({ dataJson: validated.data.data, status })
      .where(eq(businessRecords.id, id));
    await writeAudit({ userId: session.user.id, action: "update", resourceType: featureId, resourceId: id, ip: requestIp(request) });
    return ok({ id, featureId, status, data: validated.data.data });
  } catch (error) {
    return fail(error, request);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ featureId: string; id: string }> }) {
  try {
    const { featureId: raw, id } = await context.params;
    const featureId = validFeatureId(raw);
    const session = await requireWriteSession(request, featureId);
    const domainConfig = getDomainConfig(featureId);
    if (domainConfig) {
      const existing = await domainGet(domainConfig, session, id);
      if (featureId === "leave") {
        await assertWorkflowEditable(id, existing.createdBy, session);
      }
      await domainDelete(domainConfig, id);
      await writeAudit({ userId: session.user.id, action: "delete", resourceType: featureId, resourceId: id, ip: requestIp(request) });
      return ok({ deleted: true });
    }
    const record = await loadRecordInScope(session, featureId, id);
    await assertWorkflowEditable(id, record.createdBy, session);

    await getDb().delete(businessRecords).where(eq(businessRecords.id, id));
    await writeAudit({ userId: session.user.id, action: "delete", resourceType: featureId, resourceId: id, ip: requestIp(request) });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error, request);
  }
}
