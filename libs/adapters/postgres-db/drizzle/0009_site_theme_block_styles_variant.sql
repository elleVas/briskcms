-- The per-type style tier becomes per (type, VARIANT) — ADR-0047: an
-- agency recolours the ghost buttons without touching the primary ones.
--
-- The column is added FIRST and the key swapped after, which is not the
-- order `drizzle-kit generate` produced: it emitted the new primary key
-- naming a column that did not exist yet, and the migration would have
-- failed on the second statement. Worth knowing the generator can do that.
--
-- Existing rows take the column default, so they become the `default`
-- variant of their type — which is exactly what they always were.
ALTER TABLE "site_theme_block_styles" ADD COLUMN "variant" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_theme_block_styles" DROP CONSTRAINT "site_theme_block_styles_site_id_block_type_pk";--> statement-breakpoint
ALTER TABLE "site_theme_block_styles" ADD CONSTRAINT "site_theme_block_styles_site_id_block_type_variant_pk" PRIMARY KEY("site_id","block_type","variant");
