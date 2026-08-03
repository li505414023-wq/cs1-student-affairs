/**
 * Static inventory of API routes and their required permission levels.
 * Used by the ApiPermissionModule matrix (read-only visualization of the
 * actual requirePermission enforcement in each route handler).
 *
 * Level "public" = no session required; "session" = any logged-in user.
 */

export type ApiRouteEntry = {
  module: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  level: "public" | "session" | "read" | "write" | "delete" | "admin";
  description: string;
};

export const API_ROUTE_INVENTORY: readonly ApiRouteEntry[] = [
  { module: "系统", method: "GET", path: "/api/health", level: "public", description: "健康检查(验证数据库连通)" },
  { module: "认证", method: "POST", path: "/api/auth/login", level: "public", description: "登录(IP 限流 + 账号锁定)" },
  { module: "认证", method: "GET", path: "/api/auth/session", level: "public", description: "查询当前会话" },
  { module: "认证", method: "DELETE", path: "/api/auth/session", level: "session", description: "退出登录" },
  { module: "认证", method: "POST", path: "/api/auth/password", level: "read", description: "自助修改密码" },
  { module: "用户管理", method: "GET", path: "/api/admin/users", level: "admin", description: "用户列表(分页/过滤)" },
  { module: "用户管理", method: "POST", path: "/api/admin/users", level: "admin", description: "创建用户" },
  { module: "用户管理", method: "PUT", path: "/api/admin/users/[id]", level: "admin", description: "编辑用户/重置密码/解锁" },
  { module: "用户管理", method: "DELETE", path: "/api/admin/users/[id]", level: "admin", description: "停用用户" },
  { module: "用户管理", method: "DELETE", path: "/api/admin/users/[id]/sessions", level: "admin", description: "强制下线" },
  { module: "角色权限", method: "GET", path: "/api/admin/roles", level: "admin", description: "角色列表(含用户数)" },
  { module: "角色权限", method: "POST", path: "/api/admin/roles", level: "admin", description: "创建角色" },
  { module: "角色权限", method: "PUT", path: "/api/admin/roles/[id]", level: "admin", description: "编辑角色权限" },
  { module: "角色权限", method: "DELETE", path: "/api/admin/roles/[id]", level: "admin", description: "删除角色" },
  { module: "通用实体", method: "GET", path: "/api/admin/entities/[featureId]", level: "admin", description: "实体列表(17 类管理数据)" },
  { module: "通用实体", method: "POST", path: "/api/admin/entities/[featureId]", level: "admin", description: "创建实体" },
  { module: "通用实体", method: "PUT", path: "/api/admin/entities/[featureId]/[id]", level: "admin", description: "更新实体" },
  { module: "通用实体", method: "DELETE", path: "/api/admin/entities/[featureId]/[id]", level: "admin", description: "删除实体(含子项保护)" },
  { module: "审计日志", method: "GET", path: "/api/admin/logs", level: "admin", description: "审计日志多维查询" },
  { module: "学生数据", method: "GET", path: "/api/students", level: "read", description: "学生列表(按角色隔离)" },
  { module: "学生数据", method: "POST", path: "/api/students", level: "write", description: "新增学生" },
  { module: "学生数据", method: "PUT", path: "/api/students/[id]", level: "write", description: "编辑学生" },
  { module: "学生数据", method: "POST", path: "/api/students/batch", level: "write", description: "批量导入学生" },
  { module: "学生数据", method: "POST", path: "/api/students/[id]/link-user", level: "admin", description: "关联学生登录账号" },
  { module: "业务记录", method: "GET", path: "/api/records/[featureId]", level: "read", description: "记录列表(按角色隔离)" },
  { module: "业务记录", method: "POST", path: "/api/records/[featureId]", level: "write", description: "新增记录(学生可申请类放行)" },
  { module: "业务记录", method: "POST", path: "/api/records/[featureId]/batch", level: "write", description: "批量导入记录" },
  { module: "业务记录", method: "PUT", path: "/api/records/[featureId]/[id]", level: "write", description: "更新记录(审批中拒绝)" },
  { module: "业务记录", method: "DELETE", path: "/api/records/[featureId]/[id]", level: "write", description: "删除记录(审批中拒绝)" },
  { module: "班级管理", method: "GET", path: "/api/counselor-classes", level: "read", description: "辅导员-班级绑定列表" },
  { module: "班级管理", method: "POST", path: "/api/counselor-classes", level: "admin", description: "绑定辅导员班级" },
  { module: "班级管理", method: "DELETE", path: "/api/counselor-classes", level: "admin", description: "解除绑定" },
  { module: "通知", method: "GET", path: "/api/notifications", level: "read", description: "我的通知列表" },
  { module: "通知", method: "POST", path: "/api/notifications", level: "write", description: "发送通知" },
  { module: "通知", method: "PUT", path: "/api/notifications", level: "read", description: "标记已读" },
  { module: "工作流", method: "GET", path: "/api/workflow/instances", level: "read", description: "流程实例列表(按角色限定范围)" },
  { module: "工作流", method: "POST", path: "/api/workflow/instances", level: "write", description: "发起流程" },
  { module: "工作流", method: "GET", path: "/api/workflow/instances/[id]", level: "read", description: "流程详情(行级鉴权)" },
  { module: "工作流", method: "POST", path: "/api/workflow/instances/[id]", level: "write", description: "审批处理(办理人校验)" },
  { module: "工作流", method: "DELETE", path: "/api/workflow/instances/[id]", level: "write", description: "撤回流程(发起人/管理员)" },
  { module: "工作流", method: "GET", path: "/api/workflow/tasks", level: "read", description: "待办/待签/已办任务" },
  { module: "工作流", method: "POST", path: "/api/workflow/tasks", level: "write", description: "签收任务" },
  { module: "流程设计", method: "GET", path: "/api/workflows", level: "read", description: "流程模型/表单/部署" },
  { module: "流程设计", method: "POST", path: "/api/workflows", level: "write", description: "新增流程模型" },
  { module: "流程设计", method: "PUT", path: "/api/workflows", level: "admin", description: "全量同步流程定义(骤降保护)" },
];
