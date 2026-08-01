import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export const runtime = "nodejs";

/**
 * Public health endpoint for load balancers and the deploy script.
 * Proves the app process AND the database are reachable; never leaks details.
 */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ success: true, data: { status: "ok", db: "up" } });
  } catch {
    return NextResponse.json({ success: false, error: "数据库不可用" }, { status: 503 });
  }
}
