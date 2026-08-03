import { and, asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { managedItems } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Read-only reference data for cascading dropdowns (faculty → major → class,
 * dictionaries, etc.). Exposes only non-sensitive name/code of whitelisted
 * entity features to any authenticated user.
 */
const REFERENCE_FEATURES = new Set([
  "faculty-admin", "major-admin", "class-admin", "org-admin",
  "post-admin", "system-dict", "business-dict", "flow-category",
]);

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "read");
    const url = new URL(request.url);
    const feature = url.searchParams.get("feature") ?? "";
    if (!REFERENCE_FEATURES.has(feature)) return ok({ items: [] });
    const parentCode = url.searchParams.get("parentCode");

    const conditions = [eq(managedItems.featureId, feature), eq(managedItems.status, "启用")];
    if (parentCode) conditions.push(eq(managedItems.parentCode, parentCode));

    const rows = await getDb()
      .select({ code: managedItems.code, name: managedItems.name })
      .from(managedItems)
      .where(and(...conditions))
      .orderBy(asc(managedItems.sortOrder), asc(managedItems.name))
      .limit(1000);
    // Guard against duplicate names from multiple seed sources
    const seen = new Set<string>();
    const items = rows.filter((row) => (seen.has(row.name) ? false : (seen.add(row.name), true)));
    return ok({ items });
  } catch (error) {
    return fail(error, request);
  }
}
