import { promisify } from "node:util";
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { roles } from "@/db/schema";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export type Permission = "read" | "write" | "delete" | "admin";
export const ALL_PERMISSIONS: readonly Permission[] = ["read", "write", "delete", "admin"];

/**
 * FALLBACK permissions/tags — used whenever the roles table is unreachable or
 * the role is missing there. NEVER delete or repurpose this object: it is the
 * anti-lockout guarantee that keeps authentication working even if the
 * dynamic RBAC data is corrupted.
 */
export const FALLBACK_PERMISSIONS: Readonly<Record<string, ReadonlySet<Permission>>> = Object.freeze({
  admin: new Set<Permission>(["read", "write", "delete", "admin"]),
  department_admin: new Set<Permission>(["read", "write", "delete"]),
  staff: new Set<Permission>(["read", "write"]),
  counselor: new Set<Permission>(["read", "write"]),
  dorm_manager: new Set<Permission>(["read", "write"]),
  viewer: new Set<Permission>(["read"]),
  student: new Set<Permission>(["read"]),
});

const FALLBACK_ROLE_TAGS: Readonly<Record<string, string[]>> = Object.freeze({
  admin: ["管理员", "学工处管理员", "系统管理员"],
  department_admin: ["院系管理员", "部门管理员"],
  counselor: ["辅导员", "班主任"],
  dorm_manager: ["宿管员", "宿舍管理员"],
  staff: ["工作人员"],
  student: ["学生"],
  viewer: ["观察员"],
});

type CachedRole = { permissions: Set<string>; tags: string[]; expiresAt: number };
const CACHE_TTL_MS = 60_000;
const roleCache = new Map<string, CachedRole>();

/** Call after any roles-table write so permission changes apply immediately. */
export function invalidateRoleCache(): void {
  roleCache.clear();
}

async function loadRoleFromDb(role: string): Promise<CachedRole | null> {
  const [row] = await getDb()
    .select({ permissions: roles.permissions, tags: roles.tags, status: roles.status })
    .from(roles)
    .where(eq(roles.code, role))
    .limit(1);
  if (!row || row.status !== "启用") return null;
  return { permissions: new Set(row.permissions ?? []), tags: row.tags ?? [], expiresAt: Date.now() + CACHE_TTL_MS };
}

async function getRoleEntry(role: string): Promise<CachedRole | null> {
  const cached = roleCache.get(role);
  if (cached && cached.expiresAt > Date.now()) return cached;
  try {
    const fresh = await loadRoleFromDb(role);
    if (fresh) {
      roleCache.set(role, fresh);
      return fresh;
    }
  } catch {
    // DB unavailable — fall through to the static fallback below.
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length < 10) {
    throw new TypeError("密码至少需要 10 个字符");
  }
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, salt, expectedHex] = String(encoded).split("$");
    if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, "hex");
    const actual = Buffer.from(await scrypt(String(password), salt, expected.length) as Buffer);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Permission check order:
 * 1. Hard guard — the `admin` role is ALWAYS fully permitted, regardless of
 *    database state. This prevents locking the system out of administration.
 * 2. Dynamic — the roles table (cached for CACHE_TTL_MS).
 * 3. Fallback — the static FALLBACK_PERMISSIONS map.
 */
export async function hasPermission(role: string, permission: Permission): Promise<boolean> {
  if (role === "admin") return (ALL_PERMISSIONS as readonly string[]).includes(permission);
  const entry = await getRoleEntry(role);
  if (entry) return entry.permissions.has(permission);
  return FALLBACK_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Role tags for workflow assignee resolution (same resolution order). */
export async function getRoleTags(role: string): Promise<string[]> {
  const entry = await getRoleEntry(role);
  if (entry && entry.tags.length > 0) return entry.tags;
  return FALLBACK_ROLE_TAGS[role] ?? [];
}

export function getDefaultRole(): string {
  return "staff";
}
