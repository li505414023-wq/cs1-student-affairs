import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { businessRecords } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { validateRecordInput } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function validFeatureId(value: string) {
  if (!/^[a-z0-9-]{2,80}$/i.test(value)) throw new ApiError(400, "功能标识不正确");
  return value;
}

/**
 * Batch import of business records (CSV/XLSX upload in GenericModule).
 * All-or-nothing: validation failures are collected and skipped, any database
 * error rolls the whole batch back.
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
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const data = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>).data ?? row : undefined;
          const validated = validateRecordInput({ data, status: (row as Record<string, unknown>)?.status ?? "已提交" });
          if (!validated.success) {
            errors.push({ index: i, message: `第 ${i + 1} 行校验失败: ${validated.errors.map((e) => `${e.field}: ${e.message}`).join("; ") || "未知错误"}` });
            continue;
          }
          const id = randomUUID();
          await tx.insert(businessRecords).values({
            id, featureId, dataJson: validated.data.data, status: validated.data.status, createdBy: session.user.id,
          });
          saved.push({ id });
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
