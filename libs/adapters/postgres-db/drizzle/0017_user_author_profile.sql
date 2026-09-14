ALTER TABLE "users" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "former_slugs" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_storage_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_width" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_height" integer;--> statement-breakpoint
-- Give everyone who already has a display name their author address, the
-- way a new name gets one (docs/adr/0071), and by the same rule as
-- slugify(): decomposed, accents stripped, lowercased, anything else a
-- hyphen, at most 80 characters (AUTHOR_SLUG_MAX_LENGTH). Two people whose
-- names make the same slug: the first keeps it, the others get a piece of
-- their id appended, which cannot collide. Anyone can change theirs
-- afterwards.
WITH "candidates" AS (
  SELECT
    "id",
    "tenant_id",
    "created_at",
    btrim(
      left(
        btrim(
          regexp_replace(
            lower(regexp_replace(normalize("display_name", NFD), '[\u0300-\u036f]', '', 'g')),
            '[^a-z0-9]+',
            '-',
            'g'
          ),
          '-'
        ),
        80
      ),
      '-'
    ) AS "base"
  FROM "users"
  WHERE "display_name" IS NOT NULL
), "numbered" AS (
  SELECT
    "id",
    "base",
    row_number() OVER (PARTITION BY "tenant_id", "base" ORDER BY "created_at", "id") AS "n"
  FROM "candidates"
  WHERE "base" <> ''
)
UPDATE "users"
SET "slug" = CASE
  WHEN "numbered"."n" = 1 THEN "numbered"."base"
  ELSE "numbered"."base" || '-' || substr("users"."id"::text, 1, 8)
END
FROM "numbered"
WHERE "users"."id" = "numbered"."id";--> statement-breakpoint
CREATE INDEX "users_former_slugs_idx" ON "users" USING gin ("former_slugs");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_slug_unique" UNIQUE("tenant_id","slug");