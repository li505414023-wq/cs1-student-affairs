import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { counselorClasses } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "read");
    const rows = await getDb().select().from(counselorClasses);
    return ok(rows);
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const body = await readJson(request);
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const faculty = typeof body?.faculty === "string" ? body.faculty : "";
    const major = typeof body?.major === "string" ? body.major : "";
    const className = typeof body?.className === "string" ? body.className : "";
    const grade = typeof body?.grade === "string" ? body.grade : "";

    if (!userId || !className) throw new ApiError(422, "userId 和 className 为必填");
    const id = randomUUID();
    await getDb().insert(counselorClasses).values({ id, userId, faculty, major, className, grade: grade || undefined });
    return ok({ id, userId, className, faculty, major }, 201);
  } catch (error) {
    return fail(error, request);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const body = await readJson(request);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) throw new ApiError(422, "id 为必填");
    await getDb().delete(counselorClasses).where(eq(counselorClasses.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return fail(error, request);
  }
}
