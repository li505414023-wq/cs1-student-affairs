import { and, count, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { businessRecords } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordScopeConditions } from "@/lib/records-scope";
import { ApiError, fail, ok } from "@/lib/api";
import { domainStats, getDomainConfig } from "@/lib/domains";

export const runtime = "nodejs";

function validFeatureId(value: string) {
  if (!/^[a-z0-9-]{2,80}$/i.test(value)) throw new ApiError(400, "功能标识不正确");
  return value;
}

/**
 * Server-side aggregation over the FULL scoped set (not the current page),
 * fixing the per-page statistics bug. Returns total, a status distribution,
 * and the sum of each requested numeric jsonb column.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ featureId: string }> }) {
  try {
    const session = await requirePermission(request, "read");
    const { featureId: raw } = await context.params;
    const featureId = validFeatureId(raw);
    const columns = (new URL(request.url).searchParams.get("columns") ?? "")
      .split(",").map((c) => c.trim()).filter((c) => c.length > 0 && c.length <= 40).slice(0, 12);

    const domainConfig = getDomainConfig(featureId);
    if (domainConfig) {
      return ok(await domainStats(domainConfig, session, columns));
    }

    const db = getDb();
    const where = and(eq(businessRecords.featureId, featureId), ...(await recordScopeConditions(session)));

    const groups = await db.select({ status: businessRecords.status, value: count() })
      .from(businessRecords).where(where).groupBy(businessRecords.status);
    const byStatus = groups.map((g) => ({ status: g.status || "未标记", count: Number(g.value) }));
    const total = byStatus.reduce((sum, g) => sum + g.count, 0);

    const sums: Record<string, number> = {};
    for (const col of columns) {
      try {
        const [row] = await db.select({
          value: sql<number>`coalesce(sum((data_json ->> ${col})::numeric), 0)`,
        }).from(businessRecords).where(where);
        sums[col] = Number(row?.value ?? 0);
      } catch {
        sums[col] = 0;
      }
    }

    return ok({ total, byStatus, sums });
  } catch (error) {
    return fail(error, request);
  }
}
