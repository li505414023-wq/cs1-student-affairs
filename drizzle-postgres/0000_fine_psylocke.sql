CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"detail_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_records" (
	"id" text PRIMARY KEY NOT NULL,
	"feature_id" text NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT '草稿' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"csrf_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"no" text NOT NULL,
	"phone" text NOT NULL,
	"gender" text DEFAULT '未知' NOT NULL,
	"faculty" text DEFAULT '' NOT NULL,
	"major" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"grade" text DEFAULT '' NOT NULL,
	"birth_date" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '在读' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_deployments" (
	"id" text PRIMARY KEY NOT NULL,
	"model_key" text NOT NULL,
	"model_name" text NOT NULL,
	"category" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT '已部署' NOT NULL,
	"deployed_at" timestamp with time zone NOT NULL,
	"deployed_by" text
);
--> statement-breakpoint
CREATE TABLE "workflow_forms" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT '业务表单' NOT NULL,
	"status" text DEFAULT '启用' NOT NULL,
	"fields_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_models" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT '学生事务' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"form_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT '草稿' NOT NULL,
	"nodes_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_records" ADD CONSTRAINT "business_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_deployments" ADD CONSTRAINT "workflow_deployments_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_models" ADD CONSTRAINT "workflow_models_form_id_workflow_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."workflow_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "business_records_feature_idx" ON "business_records" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "business_records_status_idx" ON "business_records" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uidx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_no_uidx" ON "students" USING btree ("no");--> statement-breakpoint
CREATE INDEX "students_name_idx" ON "students" USING btree ("name");--> statement-breakpoint
CREATE INDEX "students_faculty_idx" ON "students" USING btree ("faculty");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "workflow_deployments_model_idx" ON "workflow_deployments" USING btree ("model_key");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_forms_key_uidx" ON "workflow_forms" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_models_key_uidx" ON "workflow_models" USING btree ("key");--> statement-breakpoint
CREATE INDEX "workflow_models_status_idx" ON "workflow_models" USING btree ("status");