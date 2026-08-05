import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import type { getDb as getDbType } from "@/db";
import { businessRecords } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, requestIp, writeAudit, writeSystemLog } from "@/lib/api";
import { validateRecordInput } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { afterRecordCreated, enrichRecordData, validateRecordAgainstDb, validateRecordBusiness } from "@/lib/records-hooks";

type Db = ReturnType<typeof getDbType>;

export const runtime = "nodejs";

function validFeatureId(value: string) {
  if (!/^[a-z0-9-]{2,80}$/i.test(value)) throw new ApiError(400, "功能标识不正确");
  return value;
}

/**
 * Batch import of business records (CSV/XLSX upload in GenericModule).
 * Each row runs through the same hook pipeline as single-record creation
 * (业务规则校验 → 数据库前置校验 → 数据补全 → 创建后联动); a row failing
 * validation is collected into errors and skipped, any database error rolls
 * the whole batch back.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ featureId: string }> }) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    enforceRateLimit(`batch:${session.user.id}`, 5, 60_000);
    const { featureId: raw } = await context.params;
    const featureId = validFeatureId(raw);
    const body = await readJson(request);
    const rows = Array.isArray(body?.records) ? body.records : [];

    if (rows.length === 0) throw new ApiError(422, "请提供要导入的数据");
    if (rows.length > 1000) throw new ApiError(422, "单次最多导入 1000 条记录");

    const saved: Array<{ id: string }> = [];
    const errors: Array<{ index: number; message: string }> = [];

    const db = getDb();
    try {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as Db;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const data = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>).data ?? row : undefined;
          const validated = validateRecordInput({ data, status: (row as Record<string, unknown>)?.status ?? "已提交" });
          if (!validated.success) {
            errors.push({ index: i, message: `第 ${i + 1} 行校验失败: ${validated.errors.map((e) => `${e.field}: ${e.message}`).join("; ") || "未知错误"}` });
            continue;
          }
          // 与单条创建一致的钩子流水线：手册业务规则 + 数据库前置校验 + 数据补全。
          const businessError = validateRecordBusiness(featureId, validated.data.data);
          if (businessError) {
            errors.push({ index: i, message: `第 ${i + 1} 行: ${businessError}` });
            continue;
          }
          const dbError = await validateRecordAgainstDb(featureId, validated.data.data, txDb);
          if (dbError) {
            errors.push({ index: i, message: `第 ${i + 1} 行: ${dbError}` });
            continue;
          }
          const enriched = enrichRecordData(featureId, validated.data.data as Record<string, string | number>);
          const id = randomUUID();
          await tx.insert(businessRecords).values({
            id, featureId, dataJson: enriched, status: validated.data.status, createdBy: session.user.id,
          });
          saved.push({ id });
          // 创建后联动(处分→操行分、旷课→预警、学籍异动→学籍状态)，失败不阻断导入。
          try {
            await afterRecordCreated(featureId, enriched as Record<string, string | number>, txDb, session.user.id);
          } catch (hookError) {
            writeSystemLog({
              message: `批量导入记录联动失败: ${hookError instanceof Error ? hookError.message : String(hookError)}`,
              request,
              detail: { featureId, index: i, recordId: id },
            });
          }
        }
      });
    } catch {
      throw new ApiError(500, "批量导入过程中发生数据库错误，已全部回滚，请重试");
    }

    await writeAudit({
      userId: session.user.id,
      action: "batch_import",
      resourceType: featureId,
      detail: { total: rows.length, saved: saved.length, errors: errors.length },
      ip: requestIp(request),
    });

    return ok({ saved, errors, total: rows.length, savedCount: saved.length }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
