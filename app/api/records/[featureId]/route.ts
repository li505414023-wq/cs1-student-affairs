import { and, count, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { businessRecords, students } from "@/db/schema";
import { getCurrentSession, requirePermission, validateCsrf } from "@/lib/auth";
import { hasPermission } from "@/lib/security";
import { WorkflowEngine } from "@/lib/workflow/engine";
import { isStudentApplyFeature, modelKeyForFeature } from "@/lib/feature-policy";
import { recordScopeConditions } from "@/lib/records-scope";
import { canWriteFeatureStage } from "@/app/menu-policy";
import { ApiError, fail, ok, readJson, requestIp, writeAudit, writeSystemLog } from "@/lib/api";
import { parsePagination } from "@/lib/http-utils";
import { validateRecordInput } from "@/lib/validation";
import { afterRecordCreated, enrichRecordData, validateRecordAgainstDb, validateRecordBusiness } from "@/lib/records-hooks";

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
    const { page, pageSize } = parsePagination(url);
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
    // 菜单策略(isStageVisible)只负责隐藏入口，服务端在此兜底：业务系统 config/batch 仅 admin 可写。
    if (!canWriteFeatureStage(featureId, session.user.role)) {
      throw new ApiError(403, "配置与批次数据仅管理员可维护");
    }
    validateCsrf(request, session);

    const validated = validateRecordInput(await readJson(request));
    if (!validated.success) throw new ApiError(422, "业务数据校验失败", validated.errors);
    const db = getDb();
    // 学生身份字段以会话推导覆写，防止伪造，也避免把账号 ID 误存为学号：
    // 评优一票否决、操行分聚合等业务规则均按学号 join（students 表经 userId 关联）。
    if (session.user.role === "student") {
      const data = validated.data.data;
      const [stu] = await db.select({ no: students.no, name: students.name })
        .from(students).where(eq(students.userId, session.user.id)).limit(1);
      const realName = stu?.name ?? session.user.displayName;
      if ("姓名" in data) data["姓名"] = realName;
      if ("申请人" in data) data["申请人"] = realName;
      if (stu && "学号" in data) data["学号"] = stu.no;
      if ("用户ID" in data) data["用户ID"] = session.user.id;
    }
    // 手册业务规则:前置校验(如申诉时限)+数据补全(如请假审批链)。
    const businessError = validateRecordBusiness(featureId, validated.data.data);
    if (businessError) throw new ApiError(422, businessError);
    const dbError = await validateRecordAgainstDb(featureId, validated.data.data, db);
    if (dbError) throw new ApiError(422, dbError);
    const enriched = enrichRecordData(featureId, validated.data.data as Record<string, string | number>);
    const id = randomUUID();
    const status = studentApply ? "已提交" : validated.data.status;
    await db.insert(businessRecords).values({ id, featureId, dataJson: enriched, status, createdBy: session.user.id });
    await writeAudit({ userId: session.user.id, action: "create", resourceType: featureId, resourceId: id, ip: requestIp(request) });
    // 记录间联动(处分→操行分、旷课→预警、学籍异动→学籍状态),失败不阻断主流程,但记入系统日志。
    try {
      await afterRecordCreated(featureId, enriched as Record<string, string | number>, db, session.user.id);
    } catch (hookError) {
      writeSystemLog({
        message: `记录创建联动失败: ${hookError instanceof Error ? hookError.message : String(hookError)}`,
        request,
        detail: { featureId, recordId: id },
      });
    }

    let instanceId: string | null = null;
    if (studentApply) {
      try {
        instanceId = await new WorkflowEngine().start(
          modelKeyForFeature(featureId),
          { ...enriched, applicant: session.user.displayName },
          session.user.id,
          id,
        );
        await writeAudit({ userId: session.user.id, action: "start_workflow", resourceType: "workflow_instance", resourceId: instanceId, detail: { featureId }, ip: requestIp(request) });
      } catch (flowError) {
        // 申请类业务必须启动审批流。流程缺失/异常时回滚刚写入的记录并显式报错，
        // 避免"已提交但无人审批"的静默失败（模型补种：npm run db:seed:flows）。
        await db.delete(businessRecords).where(eq(businessRecords.id, id));
        const reason = flowError instanceof Error ? flowError.message : String(flowError);
        throw new ApiError(422, `审批流程启动失败：${reason}`);
      }
    }

    return ok({ id, featureId, status, data: enriched, instanceId }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
