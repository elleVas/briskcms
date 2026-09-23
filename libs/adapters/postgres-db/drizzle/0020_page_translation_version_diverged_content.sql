ALTER TABLE "page_translation_versions" ADD COLUMN "diverged_content" jsonb;--> statement-breakpoint
-- Until now an unlinked language's own tree had no history: the row was
-- its only copy. Every change to it records a version from here on, and
-- relinking relies on the newest version holding the fork (ADR-0075), so
-- the languages already unlinked get that version now.
INSERT INTO "page_translation_versions" ("tenant_id", "page_translation_id", "field_values", "seo_meta", "diverged_content", "created_by", "created_at")
SELECT "tenant_id", "id", "field_values", "seo_meta", "diverged_content", "updated_by", now()
FROM "page_translations"
WHERE "is_diverged" AND "diverged_content" IS NOT NULL;
