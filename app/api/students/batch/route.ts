import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { students } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { validateStudentInput } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    enforceRateLimit(`batch:${session.user.id}`, 5, 60_000);
    const body = await readJson(request);
    const rows = Array.isArray(body?.students) ? body.students : [];

    if (rows.length === 0) throw new ApiError(422, "请提供要导入的学生数据");
    if (rows.length > 500) throw new ApiError(422, "单次最多导入 500 条记录");

    const db = getDb();
    const saved: Array<{ id: string; name: string; no: string }> = [];
    const errors: Array<{ index: number; message: string }> = [];

    // All-or-nothing: the whole batch runs in one transaction. Duplicate student
    // numbers are skipped via ON CONFLICT DO NOTHING (without poisoning the
    // transaction); any other write error rolls the entire import back.
    try {
      await db.transaction(async (tx) => {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const validated = validateStudentInput(row);
          if (!validated.success) {
            errors.push({ index: i, message: `第 ${i + 1} 行校验失败: ${validated.errors.map((e) => `${e.field}: ${e.message}`).join("; ") ?? "未知错误"}` });
            continue;
          }
          const id = randomUUID();
          const inserted = await tx
            .insert(students)
            .values({ id, ...validated.data, createdBy: session.user.id })
            .onConflictDoNothing({ target: students.no })
            .returning({ id: students.id, name: students.name, no: students.no });
          if (inserted.length === 0) {
            errors.push({ index: i, message: `第 ${i + 1} 行: 学号 ${validated.data.no} 已存在，已跳过` });
          } else {
            saved.push(inserted[0]);
          }
        }
      });
    } catch {
      throw new ApiError(500, "批量导入过程中发生数据库错误，已全部回滚，请重试");
    }

    await writeAudit({
      userId: session.user.id,
      action: "batch_import",
      resourceType: "student",
      detail: { total: rows.length, saved: saved.length, errors: errors.length },
      ip: requestIp(request),
    });

    return ok({ saved, errors, total: rows.length, savedCount: saved.length }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
