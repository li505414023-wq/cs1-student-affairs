import { ApiError } from "@/lib/api";

/**
 * Row-level access control for workflow instances and tasks.
 * Pure functions — easy to unit test, no DB access.
 */

export type WorkflowSessionUser = {
  id: string;
  role: string;
  roleTags?: string[] | null;
};

type InstanceLike = { startedBy: string | null };
type TaskLike = { assigneeValue: string | null; claimedBy: string | null };

/** Roles that may view and manage every instance (school-wide scope). */
const FULL_ACCESS_ROLES: ReadonlySet<string> = new Set(["admin", "department_admin"]);

export function isFullAccessRole(role: string): boolean {
  return FULL_ACCESS_ROLES.has(role);
}

/** All identity values a user can be matched against (user id, role, role tags). */
export function userIdentities(user: WorkflowSessionUser): Set<string> {
  return new Set(
    [user.id, user.role, ...(user.roleTags ?? [])].filter((value): value is string => Boolean(value)),
  );
}

/**
 * A user may see an instance when they started it, are (or were) assigned
 * one of its tasks, or hold a school-wide role.
 */
export function canAccessInstance(
  instance: InstanceLike,
  tasks: TaskLike[],
  user: WorkflowSessionUser,
): boolean {
  if (isFullAccessRole(user.role)) return true;
  if (instance.startedBy !== null && instance.startedBy === user.id) return true;
  const identities = userIdentities(user);
  return tasks.some((task) =>
    (task.assigneeValue !== null && identities.has(task.assigneeValue))
    || (task.claimedBy !== null && task.claimedBy === user.id),
  );
}

export function assertInstanceAccess(
  instance: InstanceLike,
  tasks: TaskLike[],
  user: WorkflowSessionUser,
): void {
  if (!canAccessInstance(instance, tasks, user)) {
    throw new ApiError(403, "无权访问该流程实例");
  }
}

/**
 * A user may operate on a pending task when they are the assignee
 * (by user id, role, or role tag), have claimed it, or are an admin.
 */
export function canOperateTask(task: TaskLike, user: WorkflowSessionUser): boolean {
  if (user.role === "admin") return true;
  if (task.claimedBy !== null && task.claimedBy === user.id) return true;
  const identities = userIdentities(user);
  return task.assigneeValue !== null && identities.has(task.assigneeValue);
}
