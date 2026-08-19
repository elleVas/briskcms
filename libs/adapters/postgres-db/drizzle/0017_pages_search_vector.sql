-- Generated column, not modeled in schema.ts (Drizzle has no first-class
-- DSL for tsvector/generated columns) — SearchPort's Postgres adapter
-- writes plain text to `search_text` (a normal Drizzle column) via
-- indexPage(); Postgres derives `search_vector` from it automatically on
-- every write, no application code ever computes or writes this column
-- directly. `to_tsvector('italian', ...)` is immutable with a literal
-- config name, so this is allowed in a STORED generated column — verified
-- directly against Postgres before writing this migration, not assumed.
ALTER TABLE "pages" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('italian', coalesce("search_text", ''))) STORED;
--> statement-breakpoint
CREATE INDEX "pages_search_vector_idx" ON "pages" USING GIN ("search_vector");
