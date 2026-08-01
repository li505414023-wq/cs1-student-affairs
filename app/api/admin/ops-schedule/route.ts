import { and, count, desc, eq, isNotNull, lt, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { workflowInstances, workflowTasks } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Workflow operations dashboard: instance/task statistics, overdue detection,
 * and the running-instance list (admin cancel goes through the existing
 * DELETE /api/workflow/instances/[id] endpoint).
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const db = getDb();

    const [runningRow] = await db.select({ value: count() }).from(workflowInstances).where(eq(workflowInstances.status, "运行中"));
    const [overdueRow] = await db.select({ value: count() }).from(workflowInstances)
      .where(and(eq(workflowInstances.status, "运行中"), isNotNull(workflowInstances.timeoutAt), lt(workflowInstances.timeoutAt, sql`now()`)));
    const [claimRow] = await db.select({ value: count() }).from(workflowTasks).where(eq(workflowTasks.status, "待签收"));
    const [pendingRow] = await db.select({ value: count() }).from(workflowTasks).where(eq(workflowTasks.status, "待处理"));
    const [totalRow] = await db.select({ value: count() }).from(workflowInstances);

    const instances = await db.select({
      id: workflowInstances.id,
      title: workflowInstances.title,
      modelName: workflowInstances.modelName,
      status: workflowInstances.status,
      startedAt: workflowInstances.startedAt,
      completedAt: workflowInstances.completedAt,
      timeoutAt: workflowInstances.timeoutAt,
      currentNodeId: workflowInstances.currentNodeId,
    })
      .from(workflowInstances)
      .orderBy(desc(workflowInstances.startedAt))
      .limit(50);

    return ok({
      stats: {
        running: Number(runningRow?.value ?? 0),
        overdue: Number(overdueRow?.value ?? 0),
        awaitingClaim: Number(claimRow?.value ?? 0),
        pending: Number(pendingRow?.value ?? 0),
        total: Number(totalRow?.value ?? 0),
      },
      items: instances.map((row) => ({
        ...row,
        overdue: row.status === "运行中" && row.timeoutAt !== null && row.timeoutAt.getTime() < Date.now(),
      })),
    });
  } catch (error) {
    return fail(error, request);
  }
}
