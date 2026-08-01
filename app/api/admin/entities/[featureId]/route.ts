import { and, count, eq, ilike, inArray, isNull, or, asc, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { managedItems } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { getEntityConfig, type EntityFeatureConfig } from "@/lib/entity-features";
import { validateEntityInput } from "@/lib/validation-entities";
import { ApiError, fail, isUniqueViolation, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

function resolveConfig(raw: string): EntityFeatureConfig {
  const config = getEntityConfig(raw);
  if (!config) throw new ApiError(404, "未知的功能标识");
  return config;
}

type ItemRow = typeof managedItems.$inferSelect;

function toItem(row: ItemRow, parentNames: Map<string, string>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    parentCode: row.parentCode ?? "",
    parentName: row.parentCode ? parentNames.get(row.parentCode) ?? "" : "",
    sortOrder: row.sortOrder,
    status: row.status,
    data: row.dataJson,
    createdAt: row.createdAt,
  };
}

async function resolveParentNames(config: EntityFeatureConfig, rows: ItemRow[]) {
  const names = new Map<string, string>();
  if (!config.hierarchical) return names;
  const codes = [...new Set(rows.map((row) => row.parentCode).filter((code): code is string => Boolean(code)))];
  if (codes.length === 0) return names;
  const parents = await getDb()
    .select({ code: managedItems.code, name: managedItems.name })
    .from(managedItems)
    .where(and(eq(managedItems.featureId, config.hierarchical.parentFeature), inArray(managedItems.code, codes)));
  for (const parent of parents) names.set(parent.code, parent.name);
  return names;
}

export async function GET(request: NextRequest, context: { params: Promise<{ featureId: string }> }) {
  try {
    await requirePermission(request, "admin");
    const { featureId } = await context.params;
    const config = resolveConfig(featureId);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
    const keyword = url.searchParams.get("keyword")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const parentCode = url.searchParams.get("parentCode");

    const keywordCondition = keyword
      ? or(ilike(managedItems.name, `%${keyword}%`), ilike(managedItems.code, `%${keyword}%`))
      : undefined;
    const statusCondition = status ? eq(managedItems.status, status) : undefined;
    const parentCondition = parentCode === "__root__"
      ? isNull(managedItems.parentCode)
      : parentCode ? eq(managedItems.parentCode, parentCode) : undefined;
    const where = and(eq(managedItems.featureId, featureId), keywordCondition, statusCondition, parentCondition);

    const db = getDb();
    const rows = await db.select().from(managedItems).where(where)
      .orderBy(asc(managedItems.sortOrder), desc(managedItems.createdAt))
      .limit(pageSize).offset((page - 1) * pageSize);
    const [totalRow] = await db.select({ value: count() }).from(managedItems).where(where);
    const parentNames = await resolveParentNames(config, rows);
    return ok({ items: rows.map((row) => toItem(row, parentNames)), pagination: { page, pageSize, total: Number(totalRow?.value ?? 0) } });
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ featureId: string }> }) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const { featureId } = await context.params;
    const config = resolveConfig(featureId);
    const validated = validateEntityInput(config, await readJson(request));
    if (!validated.success) throw new ApiError(422, "数据校验失败", validated.errors);
    const { code, name, description, parentCode, sortOrder, status, data } = validated.data;

    const id = randomUUID();
    try {
      await getDb().insert(managedItems).values({
        id, featureId, code, name, description,
        parentCode: parentCode || null, sortOrder, status, dataJson: data, createdBy: session.user.id,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, `编码 ${code} 已存在`);
      throw error;
    }
    await writeAudit({ userId: session.user.id, action: "create_entity", resourceType: featureId, resourceId: id, detail: { code, name }, ip: requestIp(request) });
    return ok({ id, code, name, status }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
