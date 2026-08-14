CREATE TABLE "crisis_records" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"discover_way" text DEFAULT '' NOT NULL,
	"crisis_level" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"intervention" text DEFAULT '' NOT NULL,
	"followup" text DEFAULT '' NOT NULL,
	"responsible" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '跟踪中' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_records" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"course_name" text DEFAULT '' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"measure" text DEFAULT '' NOT NULL,
	"cycle" text DEFAULT '' NOT NULL,
	"effect" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '帮扶中' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talks" (
	"id" text PRIMARY KEY NOT NULL,
	"student_no" text NOT NULL,
	"student_name" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"way" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"talk_date" text DEFAULT '' NOT NULL,
	"next_date" text DEFAULT '' NOT NULL,
	"cycle_days" integer DEFAULT 0 NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "concern_type" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "crisis_level" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "crisis_relief" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "crisis_records" ADD CONSTRAINT "crisis_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_records" ADD CONSTRAINT "help_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talks" ADD CONSTRAINT "talks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crisis_records_student_idx" ON "crisis_records" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "crisis_records_level_idx" ON "crisis_records" USING btree ("crisis_level");--> statement-breakpoint
CREATE INDEX "help_records_student_idx" ON "help_records" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "talks_student_idx" ON "talks" USING btree ("student_no");--> statement-breakpoint
CREATE INDEX "talks_date_idx" ON "talks" USING btree ("talk_date");--> statement-breakpoint
CREATE INDEX "students_crisis_idx" ON "students" USING btree ("crisis_level");