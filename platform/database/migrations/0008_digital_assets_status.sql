DROP INDEX "digital_assets_format_idx";--> statement-breakpoint
ALTER TABLE "digital_assets" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "digital_assets" ADD COLUMN "status" varchar(12) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "digital_assets" ADD COLUMN "removed_reason" text;--> statement-breakpoint
ALTER TABLE "digital_assets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "digital_assets_sha_idx" ON "digital_assets" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "digital_assets_format_idx" ON "digital_assets" USING btree ("book_format_id","status");--> statement-breakpoint
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_status_valid" CHECK ("digital_assets"."status" in ('active', 'withdrawn', 'replaced', 'removed'));