-- Incremental: link workflow instances to business records.
-- Earlier statements generated against this DB were already applied manually,
-- so this migration only carries the new record_id column.
ALTER TABLE "workflow_instances" ADD COLUMN "record_id" text;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_record_id_business_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."business_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_instances_record_idx" ON "workflow_instances" USING btree ("record_id");
