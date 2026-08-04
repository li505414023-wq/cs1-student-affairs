-- Incremental: add 专业 level to counselor-class bindings (院系 → 专业 → 区队).
-- Applied manually on production; this file keeps the migration history in sync.
ALTER TABLE "counselor_classes" ADD COLUMN "major" text NOT NULL DEFAULT '';
