CREATE TABLE "content_preview_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"content_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_preview_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "content_preview_tokens_content_type_check" CHECK ("content_preview_tokens"."content_type" in ('page', 'header', 'footer'))
);
--> statement-breakpoint
ALTER TABLE "content_preview_tokens" ADD CONSTRAINT "content_preview_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_preview_tokens_content_idx" ON "content_preview_tokens" USING btree ("content_type","content_id");