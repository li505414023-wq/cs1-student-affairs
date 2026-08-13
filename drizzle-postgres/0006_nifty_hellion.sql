CREATE TABLE "absence_warnings" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"term" text DEFAULT '' NOT NULL,
	"total_hours" integer DEFAULT 0 NOT NULL,
	"warning_level" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '预警中' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendances" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"source_feature" text DEFAULT '' NOT NULL,
	"attendance_date" text DEFAULT '' NOT NULL,
	"slot" text DEFAULT '' NOT NULL,
	"attendance_status" text DEFAULT '' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conduct_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"direction" text DEFAULT '加分' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"record_date" text DEFAULT '' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"term" text DEFAULT '' NOT NULL,
	"course_name" text DEFAULT '' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"pass_status" text DEFAULT '' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"leave_type" text DEFAULT '' NOT NULL,
	"start_at" text DEFAULT '' NOT NULL,
	"end_at" text DEFAULT '' NOT NULL,
	"days" integer DEFAULT 0 NOT NULL,
	"approval_chain" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '已提交' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "physical_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"item" text DEFAULT '' NOT NULL,
	"score" text DEFAULT '' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "punishments" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"punishment_type" text DEFAULT '' NOT NULL,
	"punishment_level" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '生效中' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"change_type" text DEFAULT '' NOT NULL,
	"effective_date" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '待处理' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "absence_warnings" ADD CONSTRAINT "absence_warnings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conduct_scores" ADD CONSTRAINT "conduct_scores_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_scores" ADD CONSTRAINT "course_scores_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_tests" ADD CONSTRAINT "physical_tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punishments" ADD CONSTRAINT "punishments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_changes" ADD CONSTRAINT "status_changes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absence_warnings_student_idx" ON "absence_warnings" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "attendances_student_idx" ON "attendances" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "attendances_date_idx" ON "attendances" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "conduct_scores_student_idx" ON "conduct_scores" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "course_scores_student_idx" ON "course_scores" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "leaves_student_idx" ON "leaves" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "leaves_status_idx" ON "leaves" USING btree ("status");--> statement-breakpoint
CREATE INDEX "physical_tests_student_idx" ON "physical_tests" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "punishments_student_idx" ON "punishments" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "punishments_status_idx" ON "punishments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "status_changes_student_idx" ON "status_changes" USING btree ("student_no");