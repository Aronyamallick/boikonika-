ALTER TABLE "kyc_verifications" ADD COLUMN "requested_role" "role_key";--> statement-breakpoint
-- Backfill existing requests: every purpose except "seller" has a role of the same name.
UPDATE "kyc_verifications" SET "requested_role" = CASE "purpose" WHEN 'seller' THEN 'book_seller'::"role_key" ELSE "purpose"::text::"role_key" END;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ALTER COLUMN "requested_role" SET NOT NULL;
