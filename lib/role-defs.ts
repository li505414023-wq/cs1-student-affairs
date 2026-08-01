/**
 * Static role definitions — client-safe (no database imports).
 * The server-side dynamic catalog (lib/role-catalog.ts) re-exports these
 * as the fallback when the roles table is unreachable.
 */

export type RoleInfo = {
  code: string;
  label: string;
  description: string;
  builtin: boolean;
};

export const BUILTIN_ROLES: readonly RoleInfo[] = [
  { code: "admin", label: "系统管理员", description: "全部权限,含用户与系统管理", builtin: true },
  { code: "department_admin", label: "院系管理员", description: "本院系数据可读可写可删", builtin: true },
  { code: "counselor", label: "辅导员", description: "所带班级数据读写", builtin: true },
  { code: "dorm_manager", label: "宿管员", description: "宿舍相关数据读写", builtin: true },
  { code: "staff", label: "工作人员", description: "常规读写权限", builtin: true },
  { code: "viewer", label: "观察员", description: "只读", builtin: true },
  { code: "student", label: "学生", description: "只读本人数据,可提交申请类业务", builtin: true },
];
