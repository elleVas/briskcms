ALTER TABLE "page_versions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "page_versions" CASCADE;--> statement-breakpoint
-- The explicit DROP CONSTRAINT drizzle-kit generated here for
-- form_submissions_page_id_pages_id_fk is omitted: DROP TABLE ... CASCADE
-- above already removes it, and re-dropping an already-gone constraint
-- errors ("does not exist").
DROP TABLE "pages" CASCADE;--> statement-breakpoint
ALTER TABLE "page_translations" ADD COLUMN "search_text" text;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_page_id_page_translations_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page_translations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."page_status";--> statement-breakpoint
-- Hand-added, same pattern as the old pages.search_vector (see
-- 0000_baseline_schema.sql) — Drizzle has no generated-column DSL, see
-- schema.ts's own comment on pageTranslations.searchText.
ALTER TABLE "page_translations" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('italian', coalesce("search_text", ''))) STORED;--> statement-breakpoint
CREATE INDEX "page_translations_search_vector_idx" ON "page_translations" USING GIN ("search_vector");