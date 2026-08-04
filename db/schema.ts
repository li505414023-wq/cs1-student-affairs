import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const systemLogs = pgTable("system_logs", {
  id: text("id").primaryKey(),
  level: text("level").notNull().default("error"),
  category: text("category").notNull().default("api"),
  message: text("message").notNull(),
  path: text("path"),
  method: text("method"),
  userId: text("user_id"),
  ip: text("ip"),
  detailJson: jsonb("detail_json").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("system_logs_level_idx").on(table.level), index("system_logs_created_idx").on(table.createdAt)]);

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  permissions: text("permissions").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  dataScope: text("data_scope").notNull().default("all"),
  builtin: boolean("builtin").notNull().default(false),
  status: text("status").notNull().default("启用"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [uniqueIndex("roles_code_uidx").on(table.code)]);

export const managedItems = pgTable("managed_items", {
  id: text("id").primaryKey(),
  featureId: text("feature_id").notNull(),
  code: text("code").notNull().default(""),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  parentCode: text("parent_code"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("启用"),
  dataJson: jsonb("data_json").$type<Record<string, unknown>>().notNull().default({}),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [
  index("managed_items_feature_idx").on(table.featureId),
  index("managed_items_parent_idx").on(table.parentCode),
  uniqueIndex("managed_items_code_uidx").on(table.featureId, table.code).where(sql`code <> ''`),
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("staff"),
  roleTags: text("role_tags").array().notNull().default([]),
  phone: text("phone"),
  email: text("email"),
  orgId: text("org_id"),
  postId: text("post_id"),
  active: boolean("active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
  ...timestamps,
}, (table) => [uniqueIndex("users_username_uidx").on(table.username)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  csrfToken: text("csrf_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("sessions_token_uidx").on(table.tokenHash), index("sessions_user_idx").on(table.userId)]);

export const students = pgTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  no: text("no").notNull(),
  phone: text("phone").notNull(),
  gender: text("gender").notNull().default("未知"),
  faculty: text("faculty").notNull().default(""),
  major: text("major").notNull().default(""),
  className: text("class_name").notNull().default(""),
  grade: text("grade").notNull().default(""),
  birthDate: text("birth_date").notNull().default(""),
  idCard: text("id_card"),
  address: text("address").notNull().default(""),
  status: text("status").notNull().default("在读"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [uniqueIndex("students_no_uidx").on(table.no), index("students_name_idx").on(table.name), index("students_faculty_idx").on(table.faculty)]);

export const businessRecords = pgTable("business_records", {
  id: text("id").primaryKey(),
  featureId: text("feature_id").notNull(),
  dataJson: jsonb("data_json").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("草稿"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [index("business_records_feature_idx").on(table.featureId), index("business_records_status_idx").on(table.status)]);

export const workflowForms = pgTable("workflow_forms", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("业务表单"),
  status: text("status").notNull().default("启用"),
  fieldsJson: jsonb("fields_json").$type<unknown[]>().notNull().default([]),
  ...timestamps,
}, (table) => [uniqueIndex("workflow_forms_key_uidx").on(table.key)]);

export const workflowModels = pgTable("workflow_models", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("学生事务"),
  description: text("description").notNull().default(""),
  formId: text("form_id").references(() => workflowForms.id, { onDelete: "set null" }),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("草稿"),
  nodesJson: jsonb("nodes_json").$type<unknown[]>().notNull().default([]),
  ...timestamps,
}, (table) => [uniqueIndex("workflow_models_key_uidx").on(table.key), index("workflow_models_status_idx").on(table.status)]);

export const workflowDeployments = pgTable("workflow_deployments", {
  id: text("id").primaryKey(),
  modelKey: text("model_key").notNull(),
  modelName: text("model_name").notNull(),
  category: text("category").notNull(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("已部署"),
  deployedAt: timestamp("deployed_at", { withTimezone: true, mode: "date" }).notNull(),
  deployedBy: text("deployed_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => [index("workflow_deployments_model_idx").on(table.modelKey)]);

// --- Workflow Runtime Engine tables (Phase 2) ---

export const workflowInstances = pgTable("workflow_instances", {
  id: text("id").primaryKey(),
  modelKey: text("model_key").notNull(),
  modelId: text("model_id").notNull(),
  modelName: text("model_name").notNull(),
  title: text("title").notNull(),
  formId: text("form_id"),
  formDataJson: jsonb("form_data_json").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("运行中"),
  currentNodeId: text("current_node_id"),
  recordId: text("record_id").references(() => businessRecords.id, { onDelete: "set null" }),
  startedBy: text("started_by").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  timeoutAt: timestamp("timeout_at", { withTimezone: true, mode: "date" }),
  ...timestamps,
}, (table) => [
  index("workflow_instances_model_idx").on(table.modelKey),
  index("workflow_instances_status_idx").on(table.status),
  index("workflow_instances_user_idx").on(table.startedBy),
  index("workflow_instances_record_idx").on(table.recordId),
]);

export const workflowTasks = pgTable("workflow_tasks", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull(),
  nodeName: text("node_name").notNull(),
  nodeType: text("node_type").notNull(),
  assigneeType: text("assignee_type").notNull().default("role"),
  assigneeValue: text("assignee_value").notNull(),
  claimedBy: text("claimed_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("待签收"),
  result: text("result"),
  comment: text("comment"),
  dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("workflow_tasks_instance_idx").on(table.instanceId),
  index("workflow_tasks_assignee_idx").on(table.assigneeValue),
  index("workflow_tasks_status_idx").on(table.status),
]);

export const workflowEventLog = pgTable("workflow_event_log", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id").notNull(),
  nodeId: text("node_id"),
  event: text("event").notNull(),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  detailJson: jsonb("detail_json").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("workflow_event_log_instance_idx").on(table.instanceId)]);

// --- Notification System ---
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("info"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  relatedId: text("related_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("notifications_user_idx").on(table.userId), index("notifications_read_idx").on(table.read)]);

// --- Counselor-Class Association ---
export const counselorClasses = pgTable("counselor_classes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  faculty: text("faculty").notNull(),
  major: text("major").notNull().default(""),
  className: text("class_name").notNull(),
  grade: text("grade"),
  ...timestamps,
}, (table) => [index("counselor_classes_user_idx").on(table.userId), index("counselor_classes_class_idx").on(table.className)]);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  detailJson: jsonb("detail_json").$type<Record<string, unknown>>().notNull().default({}),
  ip: text("ip").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("audit_logs_user_idx").on(table.userId), index("audit_logs_resource_idx").on(table.resourceType, table.resourceId)]);
