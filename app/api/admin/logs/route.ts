import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { parsePagination, queryText } from "@/lib/http-utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const url = new URL(request.url);
    const { page, pageSize } = parsePagination(url, { defaultPageSize: 50 });
    const action = queryText(url, "action");
    const userId = queryText(url, "userId");
    const resourceType = queryText(url, "resourceType");
    const resourceId = queryText(url, "resourceId");
    const from = queryText(url, "from");
    const to = queryText(url, "to");

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
