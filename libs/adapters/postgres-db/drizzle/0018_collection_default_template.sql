-- The template a new page in a collection starts from (docs/adr/0072).
-- Nullable, and `set null` when the template is deleted: it is a
-- suggestion the New page dialog preselects, and losing the template must
-- neither take the collection with it nor block the delete.
ALTER TABLE "collections" ADD COLUMN "default_template_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_default_template_id_reusable_sections_id_fk" FOREIGN KEY ("default_template_id") REFERENCES "public"."reusable_sections"("id") ON DELETE set null ON UPDATE no action;
