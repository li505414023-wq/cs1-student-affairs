/**
 * Server-side role catalog — reads from the roles table (dynamic RBAC);
 * falls back to the static builtin list if the table is unreachable or empty.
 *
 * NOTE: never import this module from client components (it pulls in `pg`).
 * Client components use BUILTIN_ROLES from "@/lib/role-defs" and fetch the
 * live list from /api/admin/roles.
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { roles } from "@/db/schema";
import { BUILTIN_ROLES, type RoleInfo } from "./role-defs";

export { BUILTIN_ROLES, type RoleInfo };

export async function getAvailableRoles(): Promise<RoleInfo[]> {
  try {
    const rows = await getDb()
      .select({ code: roles.code, name: roles.name, description: roles.description, builtin: roles.builtin })
      .from(roles)
      .where(eq(roles.status, "启用"))
      .orderBy(asc(roles.sortOrder));
    if (rows.length > 0) {
      return rows.map((row) => ({ code: row.code, label: row.name, description: row.description, builtin: row.builtin }));
    }
  } catch {
    // Table unreachable — fall back to the static catalog.
  }
  return [...BUILTIN_ROLES];
}

export async function getRoleCodes(): Promise<string[]> {
  return (await getAvailableRoles()).map((r) => r.code);
}
