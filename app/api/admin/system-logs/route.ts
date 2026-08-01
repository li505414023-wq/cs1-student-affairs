import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { systemLogs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 30));
    const level = url.searchParams.get("level")?.trim() ?? "";
    const category = url.searchParams.get("category")?.trim() ?? "";
    const keyword = url.searchParams.get("keyword")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";

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
