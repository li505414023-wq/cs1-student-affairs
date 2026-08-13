import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { CurrentSession } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { WorkflowEngine } from "@/lib/workflow/engine";
import { ATTENDANCE_FEATURES, type DomainConfig } from "./config";
import { domainScopeConditions } from "./scope";

// 真表行 → 对外兼容形状 { id, data, status, createdAt, updatedAt }。
// data 直接取 data_json，与 businessRecords 的 dataJson 同源，前端无感。
function toShape(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    data: (row.dataJson ?? {}) as Record<string, unknown>,
    status: (row.status ?? "草稿") as string,
    createdBy: (row.createdBy ?? null) as string | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// 考勤三合一共享一张表，按 source_feature 区分来源。
function sourceCondition(config: DomainConfig) {
  if (!ATTENDANCE_FEATURES.includes(config.featureId)) return undefined;
  return eq(config.table.sourceFeature, config.featureId);
}

export async function domainList(
  config: DomainConfig,
  session: CurrentSession,
  opts: { page: number; pageSize: number },
) {
  const db = getDb();
  const table = config.table;
  const conditions = [
    ...(await domainScopeConditions(session, table)),
    sourceCondition(config),
  ].filter(Boolean);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(table)
    .where(where)
    .orderBy(desc(table.createdAt))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  const [totalRow] = await db.select({ value: count() }).from(table).where(where);

  const ids = rows.map((r) => r.id as string);
  const workflowByRecord = await new WorkflowEngine().nodesForRecords(ids);
  const items = rows.map((r: Record<string, unknown>) => {
    const shape = toShape(r);
    return { ...shape, workflow: workflowByRecord[shape.id] ?? null };
  });
  return { items, pagination: { page: opts.page, pageSize: opts.pageSize, total: Number(totalRow?.value ?? 0) } };
}

// 写操作的行级校验：先区分「记录不存在(404)」与「范围外越权(403)」，
// 语义与 businessRecords 的 loadRecordInScope 对齐。
export async function domainGet(config: DomainConfig, session: CurrentSession, id: string) {
  const db = getDb();
  const table = config.table;
  const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!row) throw new ApiError(404, "记录不存在");
  const scope = await domainScopeConditions(session, table);
  if (scope.length > 0) {
    const [inScope] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, id), ...scope))
      .limit(1);
    if (!inScope) throw new ApiError(403, "无权操作该记录");
  }
  return toShape(row as Record<string, unknown>);
}

export async function domainUpdate(
  config: DomainConfig,
  id: string,
  data: Record<string, unknown>,
  status: string,
) {
  const db = getDb();
  const core = config.extractCore(data);
  await db
    .update(config.table)
    .set({ ...core, dataJson: data, status })
    .where(eq(config.table.id, id));
  return { id, featureId: config.featureId, status, data };
}

export async function domainDelete(config: DomainConfig, id: string) {
  const db = getDb();
  await db.delete(config.table).where(eq(config.table.id, id));
}

export async function domainStats(
  config: DomainConfig,
  session: CurrentSession,
  columns: string[],
) {
  const db = getDb();
  const table = config.table;
  const where = and(...(await domainScopeConditions(session, table)), sourceCondition(config) as never);

  const totalRow = await db.select({ value: count() }).from(table).where(where);
  const total = Number(totalRow[0]?.value ?? 0);

  let byStatus: Array<{ status: string; count: number }> = [];
  if (table.status) {
    const groups = await db
      .select({ status: table.status, value: count() })
      .from(table)
      .where(where)
      .groupBy(table.status);
    byStatus = groups.map((g: { status: string | null; value: number }) => ({
      status: g.status ?? "未标记",
      count: Number(g.value),
    }));
  }

  const sums: Record<string, number> = {};
  for (const col of columns) {
    try {
      const [row] = await db
        .select({ value: sql<number>`coalesce(sum((data_json ->> ${col})::numeric), 0)` })
        .from(table)
        .where(where);
      sums[col] = Number(row?.value ?? 0);
    } catch {
      sums[col] = 0;
    }
  }
  return { total, byStatus, sums };
}
