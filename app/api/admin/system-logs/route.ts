import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { systemLogs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { parsePagination, queryText } from "@/lib/http-utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const url = new URL(request.url);
    const { page, pageSize } = parsePagination(url, { defaultPageSize: 30 });
    const level = queryText(url, "level");
    const category = queryText(url, "category");
    const keyword = queryText(url, "keyword");
    const from = queryText(url, "from");
    const to = queryText(url, "to");

    const levelCondition = level ? eq(systemLogs.level, level) : undefined;
    const categoryCondition = category ? eq(systemLogs.category, category) : undefined;
    const keywordCondition = keyword ? ilike(systemLogs.message, `%${keyword}%`) : undefined;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const fromCondition = fromDate && !Number.isNaN(fromDate.getTime()) ? gte(systemLogs.createdAt, fromDate) : undefined;
    const toCondition = toDate && !Number.isNaN(toDate.getTime()) ? lte(systemLogs.createdAt, toDate) : undefined;
    const where = and(levelCondition, categoryCondition, keywordCondition, fromCondition, toCondition);

    const db = getDb();
    const items = await db.select().from(systemLogs).where(where).orderBy(desc(systemLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
    const [totalRow] = await db.select({ value: count() }).from(systemLogs).where(where);
    return ok({ items, pagination: { page, pageSize, total: Number(totalRow?.value ?? 0) } });
  } catch (error) {
    return fail(error, request);
  }
}
