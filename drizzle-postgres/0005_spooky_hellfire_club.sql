-- Adds the 专业 (major) level to counselor-class bindings (院系 → 专业 → 区队).
-- NOTE: this statement was previously applied manually on production as the
-- hand-written "0005_add_counselor_major" migration, so IF NOT EXISTS keeps it
-- idempotent for databases where it already ran.
ALTER TABLE "counselor_classes" ADD COLUMN IF NOT EXISTS "major" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
