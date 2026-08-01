import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { hashPassword } from "@/lib/security";
import { enforceRateLimit } from "@/lib/rate-limit";
import { idCardTailMatches, REGISTER_DENIED_MSG } from "@/lib/student-register";
import { validateRegisterInput } from "@/lib/validation";
import { ApiError, fail, isUniqueViolation, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Public student self-registration (no session → no CSRF; per-IP rate limit is
 * the primary control). Verifies 学号 + 姓名 + 身份证后6位 against an UNLINKED
 * student record, then creates a student-role account and links it. Every
 * mismatch collapses to REGISTER_DENIED_MSG so the endpoint is not an oracle.
 * Registration does NOT issue a session — the UI returns the user to login.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = requestIp(request);
    enforceRateLimit(`register:${ip}`, 5, 10 * 60_000);

    const validated = validateRegisterInput(await readJson(request));
    if (!validated.success) throw new ApiError(422, "注册信息校验失败", validated.errors);
    const { no, name, idCard, password } = validated.data;

    const db = getDb();
    const [student] = await db.select().from(students).where(eq(students.no, no)).limit(1);
    const matches = Boolean(student)
      && !student.userId
      && student.name.trim() === name.trim()
      && idCardTailMatches(idCard, student.idCard);
    if (!matches) throw new ApiError(422, REGISTER_DENIED_MSG);

    const userId = randomUUID();
    // Atomic account creation + student linkage; a partial failure rolls back.
    await db.transaction(async (tx) => {
      try {
        await tx.insert(users).values({
          id: userId,
          username: no,
          displayName: name,
          passwordHash: await hashPassword(password),
          role: "student",
          roleTags: ["学生"],
        });
      } catch (error) {
        // 学号 already taken as a username → deny without leaking "already registered".
        if (isUniqueViolation(error)) throw new ApiError(422, REGISTER_DENIED_MSG);
        throw error;
      }
      // Only bind if still unlinked — closes a TOCTOU window under concurrent
      // registration of the same 学号 (the unique username index is the backstop).
      const linked = await tx.update(students).set({ userId })
        .where(and(eq(students.id, student!.id), isNull(students.userId)))
        .returning({ id: students.id });
      if (linked.length === 0) throw new ApiError(422, REGISTER_DENIED_MSG);
    });

    await writeAudit({ action: "register_student", resourceType: "user", resourceId: userId, detail: { no, ip }, ip });
    return ok({ registered: true }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
