import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 50));
    const action = url.searchParams.get("action")?.trim() ?? "";
    const userId = url.searchParams.get("userId")?.trim() ?? "";
    const resourceType = url.searchParams.get("resourceType")?.trim() ?? "";
    const resourceId = url.searchParams.get("resourceId")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";

    const conditions = [];
    if (action) conditions.push(eq(auditLogs.action, action));
    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
    if (resourceId) conditions.push(eq(auditLogs.resourceId, resourceId));
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && !Number.isNaN(fromDate.getTime())) conditions.push(gte(auditLogs.createdAt, fromDate));
    if (toDate && !Number.isNaN(toDate.getTime())) conditions.push(lte(auditLogs.createdAt, toDate));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const db = getDb();
    const items = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
    const [totalRow] = await db.select({ value: count() }).from(auditLogs).where(where);
    return ok({ items, pagination: { page, pageSize, total: Number(totalRow?.value ?? 0) } });
  } catch (error) {
    return fail(error, request);
  }
}
