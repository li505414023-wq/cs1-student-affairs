ALTER TABLE "workflow_instances" DROP CONSTRAINT "workflow_instances_record_id_fkey";
--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "record_table" text DEFAULT 'business_records' NOT NULL;