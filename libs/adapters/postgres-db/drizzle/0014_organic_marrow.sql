ALTER TABLE "page_groups" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "page_groups" ADD COLUMN "content_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "page_translations" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "page_translations" ADD COLUMN "content_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "page_translations" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "page_groups" ADD CONSTRAINT "page_groups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill. The new clocks start at the row's own last change rather than
-- at the migration's clock: with `now()`, every page that existed before
-- today would read as "changed after it was published" the moment
-- anything nudged the group.
UPDATE "page_groups" SET "content_updated_at" = "updated_at";--> statement-breakpoint
UPDATE "page_translations" SET "content_updated_at" = "updated_at";--> statement-breakpoint
-- The best available guess at when a published translation went live. It
-- can only be wrong in the safe direction: too late, so an old page keeps
-- quiet, never too early, which would raise an alarm nobody could clear.
UPDATE "page_translations" SET "published_at" = "updated_at" WHERE "status" = 'published';
-- `updated_by` stays NULL on purpose. We do not know who last edited a
-- page that predates this column, and naming its creator would be making
-- it up.
