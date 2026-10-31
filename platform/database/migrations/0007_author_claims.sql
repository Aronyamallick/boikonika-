CREATE TABLE "author_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"message" text NOT NULL,
	"evidence_url" varchar(500),
	"decision_reason" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_claims_status_valid" CHECK ("author_claims"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "author_claims" ADD CONSTRAINT "author_claims_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_claims" ADD CONSTRAINT "author_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_claims" ADD CONSTRAINT "author_claims_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "author_claims_status_idx" ON "author_claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "author_claims_open_unique" ON "author_claims" USING btree ("author_id","user_id") WHERE "author_claims"."status" = 'pending';