CREATE TABLE "workflow_event_log" (
	"id" text PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"node_id" text,
	"event" text NOT NULL,
	"actor_id" text,
	"detail_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"model_key" text NOT NULL,
	"model_id" text NOT NULL,
	"model_name" text NOT NULL,
	"title" text NOT NULL,
	"form_id" text,
	"form_data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT '运行中' NOT NULL,
	"current_node_id" text,
	"started_by" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"timeout_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"node_id" text NOT NULL,
	"node_name" text NOT NULL,
	"node_type" text NOT NULL,
	"assignee_type" text DEFAULT 'role' NOT NULL,
	"assignee_value" text NOT NULL,
	"claimed_by" text,
	"status" text DEFAULT '待签收' NOT NULL,
	"result" text,
	"comment" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_event_log" ADD CONSTRAINT "workflow_event_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_event_log_instance_idx" ON "workflow_event_log" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "workflow_instances_model_idx" ON "workflow_instances" USING btree ("model_key");--> statement-breakpoint
CREATE INDEX "workflow_instances_status_idx" ON "workflow_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_instances_user_idx" ON "workflow_instances" USING btree ("started_by");--> statement-breakpoint
CREATE INDEX "workflow_tasks_instance_idx" ON "workflow_tasks" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "workflow_tasks_assignee_idx" ON "workflow_tasks" USING btree ("assignee_value");--> statement-breakpoint
CREATE INDEX "workflow_tasks_status_idx" ON "workflow_tasks" USING btree ("status");