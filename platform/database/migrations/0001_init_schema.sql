CREATE TYPE "public"."article_kind" AS ENUM('blog', 'educational', 'announcement', 'study_resource', 'help');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('all', 'student', 'teacher', 'parent', 'seller', 'author');--> statement-breakpoint
CREATE TYPE "public"."book_condition" AS ENUM('new', 'used_like_new', 'used_good', 'used_acceptable');--> statement-breakpoint
CREATE TYPE "public"."book_format" AS ENUM('hardcover', 'paperback', 'digital', 'audiobook');--> statement-breakpoint
CREATE TYPE "public"."challenge_participant_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."challenge_type" AS ENUM('days', 'pages', 'books', 'minutes');--> statement-breakpoint
CREATE TYPE "public"."club_purpose" AS ENUM('reading', 'study');--> statement-breakpoint
CREATE TYPE "public"."club_type" AS ENUM('public', 'private', 'school', 'college', 'university');--> statement-breakpoint
CREATE TYPE "public"."competition_status" AS ENUM('draft', 'open', 'judging', 'closed');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'pending_review', 'published', 'hidden', 'removed');--> statement-breakpoint
CREATE TYPE "public"."copyright_claim_status" AS ENUM('submitted', 'under_review', 'content_removed', 'rejected', 'counter_noticed', 'restored');--> statement-breakpoint
CREATE TYPE "public"."coupon_type" AS ENUM('percent', 'fixed', 'free_shipping');--> statement-breakpoint
CREATE TYPE "public"."join_policy" AS ENUM('open', 'request', 'invite');--> statement-breakpoint
CREATE TYPE "public"."kyc_document_type" AS ENUM('nid', 'passport', 'driving_license', 'trade_license', 'tin', 'publisher_document', 'student_id', 'teacher_id', 'institution_document', 'selfie');--> statement-breakpoint
CREATE TYPE "public"."kyc_purpose" AS ENUM('seller', 'author', 'publisher', 'student', 'teacher', 'institution');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'under_review', 'approved', 'rejected', 'resubmission_required');--> statement-breakpoint
CREATE TYPE "public"."library_shelf" AS ENUM('purchased', 'owned', 'currently_reading', 'completed', 'want_to_read');--> statement-breakpoint
CREATE TYPE "public"."login_result" AS ENUM('success', 'failed_password', 'failed_2fa', 'blocked', 'locked');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'pending', 'invited', 'banned', 'left');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('warning', 'content_removal', 'temporary_restriction', 'suspension', 'ban', 'no_action');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_reason" AS ENUM('initial', 'restock', 'adjustment', 'order_reserved', 'order_released', 'order_fulfilled', 'return', 'damaged');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'push', 'email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('order', 'delivery', 'follower', 'comment', 'review', 'book_release', 'author_update', 'book_club', 'reading_challenge', 'security', 'kyc', 'payout', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('register', 'login', 'verify_phone', 'verify_email', 'reset_password', 'change_contact');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cod', 'bkash', 'nagad', 'rocket', 'card', 'internet_banking', 'sandbox');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('review', 'recommendation', 'quote', 'reading_progress', 'poem', 'story', 'essay', 'study_tip', 'educational', 'question', 'discussion', 'artwork', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'pending_review', 'active', 'rejected', 'archived', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('book', 'general');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'approved', 'rejected', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'scam', 'fake_product', 'copyright', 'abuse', 'harassment', 'inappropriate', 'fraud', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('reported', 'under_review', 'action_taken', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role_key" AS ENUM('super_admin', 'admin', 'moderator', 'customer', 'student', 'teacher', 'author', 'publisher', 'book_seller', 'general_seller', 'institution', 'delivery_staff');--> statement-breakpoint
CREATE TYPE "public"."homepage_section_type" AS ENUM('hero', 'book_list', 'author_list', 'category_grid', 'banner', 'student_zone', 'book_clubs', 'reading_challenges', 'featured_sellers', 'articles', 'testimonials', 'why_choose_us');--> statement-breakpoint
CREATE TYPE "public"."seller_status" AS ENUM('pending', 'active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('book_seller', 'general_seller', 'publisher', 'author');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'packed', 'handed_to_courier', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'returned');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'banned', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'followers', 'private');--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_target_type_target_id_pk" PRIMARY KEY("follower_id","target_type","target_id"),
	CONSTRAINT "follows_target_type_valid" CHECK ("follows"."target_type" in ('user','author','publisher','store'))
);
--> statement-breakpoint
CREATE TABLE "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"identifier" varchar(254),
	"result" "login_result" NOT NULL,
	"method" varchar(20) DEFAULT 'password' NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"device_fingerprint" varchar(64),
	"suspicious" boolean DEFAULT false NOT NULL,
	"suspicious_reasons" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"provider_account_id" varchar(191) NOT NULL,
	"email" "citext",
	"profile" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"target" varchar(254) NOT NULL,
	"user_id" uuid,
	"code_hash" varchar(64) NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" "role_key" NOT NULL,
	"permission" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_permission_pk" PRIMARY KEY("role","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"key" "role_key" PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text,
	"is_staff" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" varchar(64) NOT NULL,
	"previous_token_hash" varchar(64),
	"family_id" uuid NOT NULL,
	"device_name" varchar(160),
	"platform" varchar(20) DEFAULT 'web' NOT NULL,
	"user_agent" text,
	"ip" "inet",
	"device_fingerprint" varchar(64),
	"two_factor_verified" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity_days" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"platform" varchar(20) DEFAULT 'web' NOT NULL,
	CONSTRAINT "user_activity_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "user_blocks_not_self" CHECK ("user_blocks"."blocker_id" <> "user_blocks"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"user_id" uuid NOT NULL,
	"interest" varchar(40) NOT NULL,
	"weight" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interests_user_id_interest_pk" PRIMARY KEY("user_id","interest")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"user_id" uuid NOT NULL,
	"permission" varchar(80) NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_pk" PRIMARY KEY("user_id","permission")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"avatar_key" text,
	"cover_key" text,
	"bio" varchar(600),
	"education" varchar(200),
	"institution" varchar(200),
	"location" varchar(120),
	"website" varchar(300),
	"birth_year" smallint,
	"favorite_genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"favorite_author_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"profile_visibility" "visibility" DEFAULT 'public' NOT NULL,
	"reading_stats_visibility" "visibility" DEFAULT 'followers' NOT NULL,
	"library_visibility" "visibility" DEFAULT 'followers' NOT NULL,
	"activity_visibility" "visibility" DEFAULT 'followers' NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"following_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" varchar(20) NOT NULL,
	"reason" text,
	"until" timestamp with time zone,
	"action_id" uuid,
	"lifted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "role_key" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext",
	"phone" varchar(16),
	"username" "citext" NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"password_hash" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"two_factor_secret_enc" text,
	"two_factor_enabled_at" timestamp with time zone,
	"locale" varchar(5) DEFAULT 'bn' NOT NULL,
	"theme" varchar(10) DEFAULT 'system' NOT NULL,
	"personalization_enabled" boolean DEFAULT true NOT NULL,
	"onboarded_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"failed_login_count" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"suspended_until" timestamp with time zone,
	"status_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_contact_required" CHECK ("users"."email" is not null or "users"."phone" is not null),
	CONSTRAINT "users_phone_format" CHECK ("users"."phone" is null or "users"."phone" ~ '^\+8801[3-9][0-9]{8}$'),
	CONSTRAINT "users_username_format" CHECK ("users"."username" ~ '^[A-Za-z0-9._]{3,30}$')
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" varchar(30) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"target" varchar(254),
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" uuid NOT NULL,
	"type" "kyc_document_type" NOT NULL,
	"side" varchar(10) DEFAULT 'front' NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" char(64) NOT NULL,
	"document_number_enc" text,
	"document_number_last4" varchar(4),
	"expires_on" date,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kyc_documents_size_positive" CHECK ("kyc_documents"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "kyc_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" uuid NOT NULL,
	"actor_id" uuid,
	"event" varchar(40) NOT NULL,
	"from_status" "kyc_status",
	"to_status" "kyc_status",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "kyc_purpose" NOT NULL,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"legal_name" varchar(160) NOT NULL,
	"date_of_birth" date,
	"business_name" varchar(200),
	"institution_name" varchar(200),
	"address" text,
	"declarations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewer_id" uuid,
	"review_note" text,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_started_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"retention_until" timestamp with time zone,
	"previous_verification_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"slug" varchar(140) NOT NULL,
	"name" varchar(160) NOT NULL,
	"name_alt" varchar(160),
	"bio" text,
	"photo_key" text,
	"birth_year" smallint,
	"death_year" smallint,
	"website" varchar(300),
	"is_verified" boolean DEFAULT false NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"book_count" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce("name", '')), 'A') || setweight(to_tsvector('simple', coalesce("name_alt", '')), 'A')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_authors" (
	"book_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'author' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "book_authors_book_id_author_id_role_pk" PRIMARY KEY("book_id","author_id","role")
);
--> statement-breakpoint
CREATE TABLE "book_categories" (
	"book_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "book_categories_book_id_category_id_pk" PRIMARY KEY("book_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "book_daily_stats" (
	"book_id" uuid NOT NULL,
	"day" timestamp with time zone NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"sales" integer DEFAULT 0 NOT NULL,
	"wishlists" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "book_daily_stats_book_id_day_pk" PRIMARY KEY("book_id","day")
);
--> statement-breakpoint
CREATE TABLE "book_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"format" "book_format" NOT NULL,
	"isbn13" char(13),
	"isbn10" char(10),
	"edition" varchar(80),
	"publisher_id" uuid,
	"publication_year" smallint,
	"pages" integer,
	"cover_key" text,
	"weight_grams" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_formats_isbn13_digits" CHECK ("book_formats"."isbn13" is null or "book_formats"."isbn13" ~ '^97[89][0-9]{10}$'),
	CONSTRAINT "book_formats_pages_positive" CHECK ("book_formats"."pages" is null or "book_formats"."pages" > 0)
);
--> statement-breakpoint
CREATE TABLE "book_genres" (
	"book_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	CONSTRAINT "book_genres_book_id_genre_id_pk" PRIMARY KEY("book_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "book_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"alt" varchar(200),
	"kind" varchar(20) DEFAULT 'gallery' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"title" varchar(200),
	"content" text,
	"storage_keys" text[],
	"preview_percent" smallint DEFAULT 10 NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_previews_percent_range" CHECK ("book_previews"."preview_percent" between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "book_publishers" (
	"book_id" uuid NOT NULL,
	"publisher_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'publisher' NOT NULL,
	CONSTRAINT "book_publishers_book_id_publisher_id_pk" PRIMARY KEY("book_id","publisher_id")
);
--> statement-breakpoint
CREATE TABLE "book_tags" (
	"book_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "book_tags_book_id_tag_id_pk" PRIMARY KEY("book_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(300) NOT NULL,
	"subtitle" varchar(300),
	"original_title" varchar(300),
	"description" text,
	"language" varchar(5) DEFAULT 'bn' NOT NULL,
	"primary_category_id" uuid,
	"age_group" varchar(10),
	"academic_level" varchar(20),
	"series_name" varchar(200),
	"series_number" smallint,
	"cover_key" text,
	"table_of_contents" jsonb,
	"search_text" text DEFAULT '' NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"wishlist_count" integer DEFAULT 0 NOT NULL,
	"min_price" numeric(14, 2),
	"offer_count" integer DEFAULT 0 NOT NULL,
	"first_published_year" smallint,
	"editors_pick" boolean DEFAULT false NOT NULL,
	"student_pick" boolean DEFAULT false NOT NULL,
	"teacher_pick" boolean DEFAULT false NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce("title", '')), 'A') || setweight(to_tsvector('simple', coalesce("subtitle", '') || ' ' || coalesce("original_title", '')), 'B') || setweight(to_tsvector('simple', coalesce("search_text", '')), 'B') || setweight(to_tsvector('simple', coalesce("description", '')), 'D')) STORED,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_rating_range" CHECK ("books"."rating_avg" >= 0 and "books"."rating_avg" <= 5)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" varchar(120) NOT NULL,
	"path" text NOT NULL,
	"depth" smallint DEFAULT 0 NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"icon" varchar(60),
	"image_key" text,
	"applies_to" varchar(10) DEFAULT 'both' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"seo" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_applies_to_valid" CHECK ("categories"."applies_to" in ('book','general','both'))
);
--> statement-breakpoint
CREATE TABLE "digital_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_format_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" char(64) NOT NULL,
	"uploaded_by" uuid,
	"rights_declared_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(40) NOT NULL,
	"name" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownership_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_type" varchar(20) NOT NULL,
	"subject_id" uuid NOT NULL,
	"capacity" varchar(30) NOT NULL,
	"statement" text NOT NULL,
	"authorization_doc_key" text,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publisher_authors" (
	"publisher_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publisher_authors_publisher_id_author_id_pk" PRIMARY KEY("publisher_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"slug" varchar(140) NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_alt" varchar(200),
	"description" text,
	"logo_key" text,
	"website" varchar(300),
	"address" text,
	"founded_year" smallint,
	"is_verified" boolean DEFAULT false NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(80) NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 3 NOT NULL,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_on_hand_non_negative" CHECK ("inventory"."quantity_on_hand" >= 0),
	CONSTRAINT "inventory_reserved_non_negative" CHECK ("inventory"."quantity_reserved" >= 0),
	CONSTRAINT "inventory_reserved_le_on_hand" CHECK ("inventory"."quantity_reserved" <= "inventory"."quantity_on_hand")
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"reason" "inventory_movement_reason" NOT NULL,
	"on_hand_delta" integer DEFAULT 0 NOT NULL,
	"reserved_delta" integer DEFAULT 0 NOT NULL,
	"reference_type" varchar(30),
	"reference_id" uuid,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "product_categories_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"alt" varchar(200),
	"width" integer,
	"height" integer,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" varchar(160) DEFAULT 'Default' NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"compare_at_price" numeric(14, 2),
	"currency" char(3) DEFAULT 'BDT' NOT NULL,
	"weight_grams" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_price_non_negative" CHECK ("product_variants"."price" >= 0),
	CONSTRAINT "product_variants_compare_at_valid" CHECK ("product_variants"."compare_at_price" is null or "product_variants"."compare_at_price" >= "product_variants"."price")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"type" "product_type" NOT NULL,
	"book_id" uuid,
	"book_format_id" uuid,
	"condition" "book_condition" DEFAULT 'new' NOT NULL,
	"condition_note" varchar(500),
	"title" varchar(300) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"description" text,
	"category_id" uuid,
	"brand" varchar(120),
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"price" numeric(14, 2) NOT NULL,
	"compare_at_price" numeric(14, 2),
	"currency" char(3) DEFAULT 'BDT' NOT NULL,
	"is_digital" boolean DEFAULT false NOT NULL,
	"weight_grams" integer,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce("title", '')), 'A') || setweight(to_tsvector('simple', coalesce("brand", '') || ' ' || coalesce("search_text", '')), 'B') || setweight(to_tsvector('simple', coalesce("description", '')), 'D')) STORED,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"total_stock" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_book_requires_book" CHECK (("products"."type" = 'book') = ("products"."book_id" is not null)),
	CONSTRAINT "products_price_non_negative" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_compare_at_valid" CHECK ("products"."compare_at_price" is null or "products"."compare_at_price" >= "products"."price"),
	CONSTRAINT "products_currency_bdt" CHECK ("products"."currency" = 'BDT')
);
--> statement-breakpoint
CREATE TABLE "seller_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"method" varchar(20) NOT NULL,
	"account_name" varchar(160) NOT NULL,
	"account_number_enc" text NOT NULL,
	"account_number_last4" varchar(4) NOT NULL,
	"bank_name" varchar(120),
	"branch_name" varchar(120),
	"routing_number" varchar(20),
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"tagline" varchar(200),
	"description" text,
	"logo_key" text,
	"banner_key" text,
	"phone" varchar(16),
	"email" varchar(254),
	"division" varchar(30),
	"district" varchar(40),
	"address" text,
	"return_policy" text,
	"shipping_policy" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"product_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "seller_type" NOT NULL,
	"status" "seller_status" DEFAULT 'pending' NOT NULL,
	"kyc_verification_id" uuid,
	"commission_percent" numeric(5, 2),
	"uses_platform_shipping" boolean DEFAULT true NOT NULL,
	"status_reason" text,
	"approved_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_commission_range" CHECK ("sellers"."commission_percent" is null or ("sellers"."commission_percent" >= 0 and "sellers"."commission_percent" <= 100))
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(40) DEFAULT 'home' NOT NULL,
	"recipient_name" varchar(120) NOT NULL,
	"phone" varchar(16) NOT NULL,
	"division" varchar(30) NOT NULL,
	"district" varchar(40) NOT NULL,
	"upazila" varchar(80) NOT NULL,
	"union_name" varchar(80),
	"area" varchar(120) NOT NULL,
	"address_line" varchar(300) NOT NULL,
	"postcode" varchar(4),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addresses_phone_format" CHECK ("addresses"."phone" ~ '^\+8801[3-9][0-9]{8}$'),
	CONSTRAINT "addresses_postcode_format" CHECK ("addresses"."postcode" is null or "addresses"."postcode" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"saved_for_later" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_cart_id_variant_id_pk" PRIMARY KEY("cart_id","variant_id"),
	CONSTRAINT "cart_items_quantity_range" CHECK ("cart_items"."quantity" between 1 and 99)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"guest_token" varchar(64),
	"coupon_code" "citext",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carts_owner_required" CHECK ("carts"."user_id" is not null or "carts"."guest_token" is not null)
);
--> statement-breakpoint
CREATE TABLE "coupon_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"discount_amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "citext" NOT NULL,
	"seller_id" uuid,
	"type" "coupon_type" NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"min_order_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"max_discount_amount" numeric(14, 2),
	"usage_limit" integer,
	"per_user_limit" smallint DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_value_positive" CHECK ("coupons"."value" >= 0),
	CONSTRAINT "coupons_percent_range" CHECK ("coupons"."type" <> 'percent' or ("coupons"."value" > 0 and "coupons"."value" <= 100)),
	CONSTRAINT "coupons_dates_valid" CHECK ("coupons"."ends_at" is null or "coupons"."starts_at" is null or "coupons"."ends_at" > "coupons"."starts_at"),
	CONSTRAINT "coupons_used_within_limit" CHECK ("coupons"."usage_limit" is null or "coupons"."used_count" <= "coupons"."usage_limit")
);
--> statement-breakpoint
CREATE TABLE "recently_viewed" (
	"user_id" uuid NOT NULL,
	"target_type" varchar(10) NOT NULL,
	"target_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recently_viewed_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"normalized" varchar(200) PRIMARY KEY NOT NULL,
	"display" varchar(200) NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"last_searched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wishlist_id" uuid NOT NULL,
	"book_id" uuid,
	"product_id" uuid,
	"notify_on_discount" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_target_exactly_one" CHECK (num_nonnulls("wishlist_items"."book_id", "wishlist_items"."product_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) DEFAULT 'Wishlist' NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"book_id" uuid,
	"title" varchar(300) NOT NULL,
	"variant_name" varchar(160),
	"sku" varchar(64) NOT NULL,
	"image_key" text,
	"condition" "book_condition",
	"is_digital" boolean DEFAULT false NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"refunded_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_refunded_le_quantity" CHECK ("order_items"."refunded_quantity" between 0 and "order_items"."quantity"),
	CONSTRAINT "order_items_line_total_consistent" CHECK ("order_items"."line_total" = "order_items"."unit_price" * "order_items"."quantity" - "order_items"."discount_amount")
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_order_id" uuid,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(20),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" varchar(24) NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"currency" char(3) DEFAULT 'BDT' NOT NULL,
	"items_subtotal" numeric(14, 2) NOT NULL,
	"discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shipping_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) NOT NULL,
	"refunded_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"coupon_id" uuid,
	"coupon_code" varchar(40),
	"shipping_address" jsonb NOT NULL,
	"customer_note" varchar(500),
	"idempotency_key" varchar(80),
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"payment_due_at" timestamp with time zone,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_totals_non_negative" CHECK ("orders"."items_subtotal" >= 0 and "orders"."discount_total" >= 0 and "orders"."shipping_total" >= 0 and "orders"."grand_total" >= 0),
	CONSTRAINT "orders_grand_total_consistent" CHECK ("orders"."grand_total" = "orders"."items_subtotal" - "orders"."discount_total" + "orders"."shipping_total" + "orders"."tax_total"),
	CONSTRAINT "orders_refund_le_total" CHECK ("orders"."refunded_total" <= "orders"."grand_total")
);
--> statement-breakpoint
CREATE TABLE "return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_request_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"restock" boolean DEFAULT true NOT NULL,
	CONSTRAINT "return_items_quantity_positive" CHECK ("return_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "return_status" DEFAULT 'requested' NOT NULL,
	"reason" varchar(40) NOT NULL,
	"details" text,
	"photo_keys" text[],
	"seller_note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"number" varchar(28) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"currency" char(3) DEFAULT 'BDT' NOT NULL,
	"items_subtotal" numeric(14, 2) NOT NULL,
	"discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shipping_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"commission_percent" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(14, 2) NOT NULL,
	"seller_earning" numeric(14, 2) NOT NULL,
	"refunded_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shipping_method_id" uuid,
	"uses_platform_shipping" boolean DEFAULT true NOT NULL,
	"confirmed_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_orders_amounts_non_negative" CHECK ("seller_orders"."items_subtotal" >= 0 and "seller_orders"."commission_amount" >= 0 and "seller_orders"."seller_earning" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" varchar(30) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"provider_event_id" varchar(191),
	"status" varchar(30) NOT NULL,
	"amount" numeric(14, 2),
	"payload_sha256" char(64),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider" varchar(30) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"refunded_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'BDT' NOT NULL,
	"provider_payment_id" varchar(191),
	"provider_transaction_id" varchar(191),
	"redirect_url" text,
	"idempotency_key" varchar(80) NOT NULL,
	"failure_reason" text,
	"expires_at" timestamp with time zone,
	"authorized_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" >= 0),
	CONSTRAINT "payments_refund_le_amount" CHECK ("payments"."refunded_amount" <= "payments"."amount")
);
--> statement-breakpoint
CREATE TABLE "payout_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"seller_order_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"payout_account_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"currency" char(3) DEFAULT 'BDT' NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"reference" varchar(120),
	"note" text,
	"processed_by" uuid,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_amount_positive" CHECK ("payouts"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_order_id" uuid,
	"payment_id" uuid,
	"return_request_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"currency" char(3) DEFAULT 'BDT' NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"method" varchar(20) DEFAULT 'original' NOT NULL,
	"provider_refund_id" varchar(191),
	"requested_by" uuid,
	"approved_by" uuid,
	"failure_reason" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "shipment_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" "shipment_status" NOT NULL,
	"location" varchar(160),
	"note" text,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"actor_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_order_id" uuid NOT NULL,
	"shipping_method_id" uuid,
	"courier" varchar(30) DEFAULT 'manual' NOT NULL,
	"tracking_number" varchar(80),
	"tracking_url" text,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"cod_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"weight_grams" integer,
	"assigned_staff_id" uuid,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid,
	"code" varchar(40) NOT NULL,
	"name" jsonb NOT NULL,
	"courier" varchar(30) DEFAULT 'manual' NOT NULL,
	"inside_dhaka_fee" numeric(14, 2) NOT NULL,
	"outside_dhaka_fee" numeric(14, 2) NOT NULL,
	"per_extra_kg_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"free_shipping_threshold" numeric(14, 2),
	"currency" char(3) DEFAULT 'BDT' NOT NULL,
	"min_days" smallint DEFAULT 1 NOT NULL,
	"max_days" smallint DEFAULT 5 NOT NULL,
	"supports_cod" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_methods_fees_non_negative" CHECK ("shipping_methods"."inside_dhaka_fee" >= 0 and "shipping_methods"."outside_dhaka_fee" >= 0),
	CONSTRAINT "shipping_methods_days_valid" CHECK ("shipping_methods"."min_days" >= 0 and "shipping_methods"."max_days" >= "shipping_methods"."min_days")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id"),
	CONSTRAINT "bookmarks_target_type_valid" CHECK ("bookmarks"."target_type" in ('post','article','book','quiz'))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"user_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id"),
	CONSTRAINT "likes_target_type_valid" CHECK ("likes"."target_type" in ('post','comment','club_post','article'))
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"kind" varchar(10) DEFAULT 'image' NOT NULL,
	"alt" varchar(300),
	"width" integer,
	"height" integer,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"type" "post_type" NOT NULL,
	"title" varchar(200),
	"body" text NOT NULL,
	"book_id" uuid,
	"quote_source" varchar(200),
	"reading_percent" smallint,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"language" varchar(5),
	"is_student_zone" boolean DEFAULT false NOT NULL,
	"subject" varchar(60),
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"bookmark_count" integer DEFAULT 0 NOT NULL,
	"share_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_reading_percent_range" CHECK ("posts"."reading_percent" is null or "posts"."reading_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "review_votes" (
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"helpful" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_votes_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid,
	"product_id" uuid,
	"seller_id" uuid,
	"order_item_id" uuid,
	"rating" smallint NOT NULL,
	"title" varchar(160),
	"body" text,
	"pros" text[],
	"cons" text[],
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"suspicion_score" smallint DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"not_helpful_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"seller_reply" text,
	"seller_replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_target_required" CHECK ("reviews"."book_id" is not null or "reviews"."product_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "book_club_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"month" date NOT NULL,
	"status" varchar(12) DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_club_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" varchar(200),
	"online_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_club_events_time_valid" CHECK ("book_club_events"."ends_at" is null or "book_club_events"."ends_at" > "book_club_events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "book_club_members" (
	"club_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invited_by" uuid,
	CONSTRAINT "book_club_members_club_id_user_id_pk" PRIMARY KEY("club_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "book_club_poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" varchar(200) NOT NULL,
	"book_id" uuid,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_club_poll_votes" (
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_club_poll_votes_poll_id_option_id_user_id_pk" PRIMARY KEY("poll_id","option_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "book_club_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"question" varchar(300) NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"closes_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_club_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"title" varchar(200),
	"body" text NOT NULL,
	"kind" varchar(20) DEFAULT 'discussion' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_club_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_book_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"from_page" integer,
	"to_page" integer,
	"due_on" date NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"type" "club_type" DEFAULT 'public' NOT NULL,
	"purpose" "club_purpose" DEFAULT 'reading' NOT NULL,
	"subject" varchar(60),
	"institution_name" varchar(200),
	"join_policy" "join_policy" DEFAULT 'open' NOT NULL,
	"cover_key" text,
	"owner_id" uuid NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"rules" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"icon" varchar(60) NOT NULL,
	"criteria" jsonb NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_participants" (
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" "challenge_participant_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "challenge_participants_challenge_id_user_id_pk" PRIMARY KEY("challenge_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"digital_asset_id" uuid NOT NULL,
	"ip" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"type" "challenge_type" NOT NULL,
	"target" integer NOT NULL,
	"duration_days" smallint,
	"genre_key" varchar(40),
	"language" varchar(5),
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"badge_id" uuid,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_challenges_target_positive" CHECK ("reading_challenges"."target" > 0)
);
--> statement-breakpoint
CREATE TABLE "reading_goals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"daily_minutes" smallint DEFAULT 20 NOT NULL,
	"weekly_minutes" smallint DEFAULT 120 NOT NULL,
	"yearly_books" smallint DEFAULT 12 NOT NULL,
	"break_reminder_minutes" smallint,
	"monthly_summary_email" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_goals_daily_range" CHECK ("reading_goals"."daily_minutes" between 1 and 600),
	CONSTRAINT "reading_goals_break_range" CHECK ("reading_goals"."break_reminder_minutes" is null or "reading_goals"."break_reminder_minutes" between 10 and 180)
);
--> statement-breakpoint
CREATE TABLE "reading_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"event" varchar(20) NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_list_items" (
	"list_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"note" varchar(300),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_list_items_list_id_book_id_pk" PRIMARY KEY("list_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "reading_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"current_page" integer DEFAULT 0 NOT NULL,
	"total_pages" integer,
	"percent" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_progress_user_id_book_id_pk" PRIMARY KEY("user_id","book_id"),
	CONSTRAINT "reading_progress_percent_range" CHECK ("reading_progress"."percent" between 0 and 100),
	CONSTRAINT "reading_progress_page_non_negative" CHECK ("reading_progress"."current_page" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reading_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"minutes" integer NOT NULL,
	"pages" integer DEFAULT 0 NOT NULL,
	"source" varchar(10) DEFAULT 'timer' NOT NULL,
	"local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_sessions_minutes_range" CHECK ("reading_sessions"."minutes" between 1 and 600),
	CONSTRAINT "reading_sessions_pages_range" CHECK ("reading_sessions"."pages" between 0 and 2000),
	CONSTRAINT "reading_sessions_time_valid" CHECK ("reading_sessions"."ended_at" > "reading_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_badges_user_id_badge_id_pk" PRIMARY KEY("user_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE "user_library" (
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"shelf" "library_shelf" NOT NULL,
	"source" varchar(12) DEFAULT 'manual' NOT NULL,
	"order_item_id" uuid,
	"has_digital_access" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_library_user_id_book_id_pk" PRIMARY KEY("user_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"level" smallint DEFAULT 1 NOT NULL,
	"books_completed" integer DEFAULT 0 NOT NULL,
	"pages_read" integer DEFAULT 0 NOT NULL,
	"minutes_read" integer DEFAULT 0 NOT NULL,
	"reviews_written" integer DEFAULT 0 NOT NULL,
	"posts_published" integer DEFAULT 0 NOT NULL,
	"quizzes_passed" integer DEFAULT 0 NOT NULL,
	"current_streak" smallint DEFAULT 0 NOT NULL,
	"longest_streak" smallint DEFAULT 0 NOT NULL,
	"last_read_on" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" varchar(30) NOT NULL,
	"source_id" varchar(64) NOT NULL,
	"xp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_events_xp_range" CHECK ("xp_events"."xp" between -1000 and 1000)
);
--> statement-breakpoint
CREATE TABLE "competition_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"status" varchar(15) DEFAULT 'submitted' NOT NULL,
	"score" smallint,
	"judge_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"title" varchar(200) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"rules" text NOT NULL,
	"prizes" text,
	"audience" "audience" DEFAULT 'student' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "competition_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_time_valid" CHECK ("competitions"."ends_at" > "competitions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"audience" "audience" DEFAULT 'all' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" varchar(200),
	"online_url" text,
	"organizer" varchar(200),
	"cover_key" text,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"correct_count" smallint NOT NULL,
	"total_count" smallint NOT NULL,
	"score_percent" smallint NOT NULL,
	"passed" boolean NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" smallint NOT NULL,
	"explanation" text,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "quiz_questions_correct_index_valid" CHECK ("quiz_questions"."correct_index" >= 0 and "quiz_questions"."correct_index" < jsonb_array_length("quiz_questions"."options"))
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"subject" varchar(60) NOT NULL,
	"academic_level" varchar(20) DEFAULT 'general' NOT NULL,
	"language" varchar(5) DEFAULT 'bn' NOT NULL,
	"book_id" uuid,
	"time_limit_seconds" integer,
	"pass_percent" smallint DEFAULT 60 NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_by" uuid,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quizzes_pass_percent_range" CHECK ("quizzes"."pass_percent" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "scholarships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"title" varchar(200) NOT NULL,
	"provider" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"eligibility" text,
	"amount_text" varchar(120),
	"academic_level" varchar(20),
	"deadline" date,
	"apply_url" text,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid,
	"subject" varchar(60),
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"page" integer,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_type_channel_pk" PRIMARY KEY("user_id","type","channel")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"link" varchar(500),
	"data" jsonb,
	"actor_id" uuid,
	"group_key" varchar(120),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" varchar(10) NOT NULL,
	"recipient" varchar(254) NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"html" text,
	"template" varchar(60),
	"status" "outbox_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb,
	"user_agent" text,
	"failure_count" smallint DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copyright_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claimant_user_id" uuid,
	"claimant_name" varchar(160) NOT NULL,
	"claimant_email" varchar(254) NOT NULL,
	"claimant_phone" varchar(20),
	"rights_holder" varchar(200) NOT NULL,
	"work_description" text NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"evidence_urls" text[],
	"good_faith_statement" boolean NOT NULL,
	"accuracy_statement" boolean NOT NULL,
	"signature" varchar(160) NOT NULL,
	"status" "copyright_claim_status" DEFAULT 'submitted' NOT NULL,
	"respondent_user_id" uuid,
	"counter_statement" text,
	"counter_signature" varchar(160),
	"counter_submitted_at" timestamp with time zone,
	"admin_note" text,
	"handled_by" uuid,
	"resolved_at" timestamp with time zone,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copyright_claims_statements_required" CHECK ("copyright_claims"."good_faith_statement" and "copyright_claims"."accuracy_statement")
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"target_user_id" uuid,
	"action" "moderation_action" NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"actor_id" uuid NOT NULL,
	"reverted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"target_user_id" uuid,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'reported' NOT NULL,
	"priority" varchar(10) DEFAULT 'normal' NOT NULL,
	"assigned_to" uuid,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_target_type_valid" CHECK ("reports"."target_type" in ('post','comment','review','product','book','user','club','club_post','store'))
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160) NOT NULL,
	"kind" "article_kind" NOT NULL,
	"title" varchar(220) NOT NULL,
	"excerpt" varchar(400),
	"body" text NOT NULL,
	"cover_key" text,
	"author_id" uuid,
	"audience" "audience" DEFAULT 'all' NOT NULL,
	"subject" varchar(60),
	"academic_level" varchar(20),
	"language" varchar(5) DEFAULT 'bn' NOT NULL,
	"tags" text[],
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" jsonb NOT NULL,
	"subtitle" jsonb,
	"image_key" text NOT NULL,
	"mobile_image_key" text,
	"link" varchar(500),
	"cta_label" jsonb,
	"placement" varchar(30) DEFAULT 'home' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"seo" jsonb,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(40) DEFAULT 'general' NOT NULL,
	"question" jsonb NOT NULL,
	"answer" jsonb NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(60) NOT NULL,
	"type" "homepage_section_type" NOT NULL,
	"title" jsonb NOT NULL,
	"subtitle" jsonb,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" jsonb,
	"quote" jsonb NOT NULL,
	"avatar_key" text,
	"user_id" uuid,
	"consent_given_at" timestamp with time zone NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"feature" varchar(30) NOT NULL,
	"model" varchar(60) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event" varchar(40) NOT NULL,
	"user_id" uuid,
	"anonymous_id" varchar(64),
	"entity_type" varchar(20),
	"entity_id" uuid,
	"seller_id" uuid,
	"properties" jsonb,
	"platform" varchar(10) DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" varchar(64),
	"before" jsonb,
	"after" jsonb,
	"ip" varchar(45),
	"user_agent" text,
	"request_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_roles_key_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_permissions_key_fk" FOREIGN KEY ("permission") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_permissions_key_fk" FOREIGN KEY ("permission") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_roles_key_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_verification_id_kyc_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."kyc_verifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_events" ADD CONSTRAINT "kyc_events_verification_id_kyc_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."kyc_verifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_events" ADD CONSTRAINT "kyc_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_daily_stats" ADD CONSTRAINT "book_daily_stats_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_formats" ADD CONSTRAINT "book_formats_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_formats" ADD CONSTRAINT "book_formats_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_genres" ADD CONSTRAINT "book_genres_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_genres" ADD CONSTRAINT "book_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_images" ADD CONSTRAINT "book_images_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_previews" ADD CONSTRAINT "book_previews_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_previews" ADD CONSTRAINT "book_previews_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_publishers" ADD CONSTRAINT "book_publishers_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_publishers" ADD CONSTRAINT "book_publishers_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_book_format_id_book_formats_id_fk" FOREIGN KEY ("book_format_id") REFERENCES "public"."book_formats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_declarations" ADD CONSTRAINT "ownership_declarations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_authors" ADD CONSTRAINT "publisher_authors_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_authors" ADD CONSTRAINT "publisher_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishers" ADD CONSTRAINT "publishers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_book_format_id_book_formats_id_fk" FOREIGN KEY ("book_format_id") REFERENCES "public"."book_formats"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_stores" ADD CONSTRAINT "seller_stores_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_kyc_verification_id_kyc_verifications_id_fk" FOREIGN KEY ("kyc_verification_id") REFERENCES "public"."kyc_verifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_account_id_seller_payout_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."seller_payout_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_tracking" ADD CONSTRAINT "shipment_tracking_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_tracking" ADD CONSTRAINT "shipment_tracking_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipping_method_id_shipping_methods_id_fk" FOREIGN KEY ("shipping_method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_books" ADD CONSTRAINT "book_club_books_club_id_book_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."book_clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_books" ADD CONSTRAINT "book_club_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_events" ADD CONSTRAINT "book_club_events_club_id_book_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."book_clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_events" ADD CONSTRAINT "book_club_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_members" ADD CONSTRAINT "book_club_members_club_id_book_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."book_clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_members" ADD CONSTRAINT "book_club_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_members" ADD CONSTRAINT "book_club_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_poll_options" ADD CONSTRAINT "book_club_poll_options_poll_id_book_club_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."book_club_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_poll_options" ADD CONSTRAINT "book_club_poll_options_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_poll_votes" ADD CONSTRAINT "book_club_poll_votes_poll_id_book_club_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."book_club_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_poll_votes" ADD CONSTRAINT "book_club_poll_votes_option_id_book_club_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."book_club_poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_poll_votes" ADD CONSTRAINT "book_club_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_polls" ADD CONSTRAINT "book_club_polls_club_id_book_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."book_clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_polls" ADD CONSTRAINT "book_club_polls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_posts" ADD CONSTRAINT "book_club_posts_club_id_book_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."book_clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_posts" ADD CONSTRAINT "book_club_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_posts" ADD CONSTRAINT "book_club_posts_parent_id_book_club_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."book_club_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_club_schedule" ADD CONSTRAINT "book_club_schedule_club_book_id_book_club_books_id_fk" FOREIGN KEY ("club_book_id") REFERENCES "public"."book_club_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_clubs" ADD CONSTRAINT "book_clubs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_reading_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."reading_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_digital_asset_id_digital_assets_id_fk" FOREIGN KEY ("digital_asset_id") REFERENCES "public"."digital_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_challenges" ADD CONSTRAINT "reading_challenges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_challenges" ADD CONSTRAINT "reading_challenges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_goals" ADD CONSTRAINT "reading_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_list_items" ADD CONSTRAINT "reading_list_items_list_id_reading_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."reading_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_list_items" ADD CONSTRAINT "reading_list_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_lists" ADD CONSTRAINT "reading_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_claims" ADD CONSTRAINT "copyright_claims_claimant_user_id_users_id_fk" FOREIGN KEY ("claimant_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_claims" ADD CONSTRAINT "copyright_claims_respondent_user_id_users_id_fk" FOREIGN KEY ("respondent_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_claims" ADD CONSTRAINT "copyright_claims_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_sections" ADD CONSTRAINT "homepage_sections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follows_target_idx" ON "follows" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "login_events_user_created_idx" ON "login_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "login_events_ip_created_idx" ON "login_events" USING btree ("ip","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_account_unique" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "otp_codes_target_purpose_idx" ON "otp_codes" USING btree ("target","purpose","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_token_hash_unique" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_active_idx" ON "sessions" USING btree ("user_id") WHERE "sessions"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_previous_token_hash_idx" ON "sessions" USING btree ("previous_token_hash");--> statement-breakpoint
CREATE INDEX "two_factor_recovery_codes_user_idx" ON "two_factor_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_activity_days_day_idx" ON "user_activity_days" USING btree ("day");--> statement-breakpoint
CREATE INDEX "user_interests_interest_idx" ON "user_interests" USING btree ("interest");--> statement-breakpoint
CREATE INDEX "user_restrictions_user_idx" ON "user_restrictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE "users"."email" is not null and "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone") WHERE "users"."phone" is not null and "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_token_hash_unique" ON "verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "kyc_documents_verification_idx" ON "kyc_documents" USING btree ("verification_id");--> statement-breakpoint
CREATE INDEX "kyc_events_verification_idx" ON "kyc_events" USING btree ("verification_id","created_at");--> statement-breakpoint
CREATE INDEX "kyc_verifications_user_idx" ON "kyc_verifications" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "kyc_verifications_status_idx" ON "kyc_verifications" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_verifications_open_unique" ON "kyc_verifications" USING btree ("user_id","purpose") WHERE "kyc_verifications"."status" in ('pending','under_review');--> statement-breakpoint
CREATE UNIQUE INDEX "authors_slug_unique" ON "authors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "authors_user_unique" ON "authors" USING btree ("user_id") WHERE "authors"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "authors_name_trgm_idx" ON "authors" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "authors_search_idx" ON "authors" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "book_authors_author_idx" ON "book_authors" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "book_categories_category_idx" ON "book_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "book_daily_stats_day_idx" ON "book_daily_stats" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "book_formats_isbn13_unique" ON "book_formats" USING btree ("isbn13") WHERE "book_formats"."isbn13" is not null;--> statement-breakpoint
CREATE INDEX "book_formats_book_idx" ON "book_formats" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "book_formats_publisher_idx" ON "book_formats" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "book_genres_genre_idx" ON "book_genres" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "book_images_book_idx" ON "book_images" USING btree ("book_id","position");--> statement-breakpoint
CREATE INDEX "book_previews_book_idx" ON "book_previews" USING btree ("book_id","position");--> statement-breakpoint
CREATE INDEX "book_publishers_publisher_idx" ON "book_publishers" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "book_tags_tag_idx" ON "book_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "books_slug_unique" ON "books" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "books_search_idx" ON "books" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "books_title_trgm_idx" ON "books" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "books_category_idx" ON "books" USING btree ("primary_category_id");--> statement-breakpoint
CREATE INDEX "books_published_idx" ON "books" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "books_sales_idx" ON "books" USING btree ("sales_count");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_path_unique" ON "categories" USING btree ("path");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id","position");--> statement-breakpoint
CREATE INDEX "digital_assets_format_idx" ON "digital_assets" USING btree ("book_format_id");--> statement-breakpoint
CREATE UNIQUE INDEX "genres_key_unique" ON "genres" USING btree ("key");--> statement-breakpoint
CREATE INDEX "ownership_declarations_subject_idx" ON "ownership_declarations" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publishers_slug_unique" ON "publishers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "publishers_name_trgm_idx" ON "publishers" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_unique" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tags_name_trgm_idx" ON "tags" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "inventory_movements_variant_idx" ON "inventory_movements" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_reference_idx" ON "inventory_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "product_categories_category_idx" ON "product_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_unique" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_unique" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_seller_status_idx" ON "products" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "products_book_idx" ON "products" USING btree ("book_id") WHERE "products"."book_id" is not null;--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "products_listing_idx" ON "products" USING btree ("status","type","published_at");--> statement-breakpoint
CREATE INDEX "products_price_idx" ON "products" USING btree ("price");--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "products_title_trgm_idx" ON "products" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "products_seller_book_condition_unique" ON "products" USING btree ("seller_id","book_format_id","condition") WHERE "products"."book_format_id" is not null and "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "seller_payout_accounts_seller_idx" ON "seller_payout_accounts" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_stores_slug_unique" ON "seller_stores" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_stores_seller_unique" ON "seller_stores" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "seller_stores_name_trgm_idx" ON "seller_stores" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_user_unique" ON "sellers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sellers_status_idx" ON "sellers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "addresses" USING btree ("user_id") WHERE "addresses"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "carts_user_unique" ON "carts" USING btree ("user_id") WHERE "carts"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "carts_guest_unique" ON "carts" USING btree ("guest_token") WHERE "carts"."guest_token" is not null;--> statement-breakpoint
CREATE INDEX "coupon_usages_coupon_user_idx" ON "coupon_usages" USING btree ("coupon_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_usages_order_unique" ON "coupon_usages" USING btree ("coupon_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_unique" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "recently_viewed_user_time_idx" ON "recently_viewed" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "search_history_user_time_idx" ON "search_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "search_queries_count_idx" ON "search_queries" USING btree ("count");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_items_book_unique" ON "wishlist_items" USING btree ("wishlist_id","book_id") WHERE "wishlist_items"."book_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_items_product_unique" ON "wishlist_items" USING btree ("wishlist_id","product_id") WHERE "wishlist_items"."product_id" is not null;--> statement-breakpoint
CREATE INDEX "wishlists_user_idx" ON "wishlists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlists_one_default_per_user" ON "wishlists" USING btree ("user_id") WHERE "wishlists"."is_default";--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_seller_order_idx" ON "order_items" USING btree ("seller_order_id");--> statement-breakpoint
CREATE INDEX "order_items_book_idx" ON "order_items" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_unique" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_user_idempotency_unique" ON "orders" USING btree ("user_id","idempotency_key") WHERE "orders"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "orders_user_placed_idx" ON "orders" USING btree ("user_id","placed_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","placed_at");--> statement-breakpoint
CREATE INDEX "orders_payment_due_idx" ON "orders" USING btree ("payment_due_at") WHERE "orders"."payment_status" = 'pending' and "orders"."payment_method" <> 'cod';--> statement-breakpoint
CREATE UNIQUE INDEX "return_items_request_item_unique" ON "return_items" USING btree ("return_request_id","order_item_id");--> statement-breakpoint
CREATE INDEX "return_requests_seller_order_idx" ON "return_requests" USING btree ("seller_order_id");--> statement-breakpoint
CREATE INDEX "return_requests_status_idx" ON "return_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_orders_number_unique" ON "seller_orders" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_orders_order_seller_unique" ON "seller_orders" USING btree ("order_id","seller_id");--> statement-breakpoint
CREATE INDEX "seller_orders_seller_status_idx" ON "seller_orders" USING btree ("seller_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_provider_event_unique" ON "payment_transactions" USING btree ("provider","provider_event_id") WHERE "payment_transactions"."provider_event_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_transactions_payment_idx" ON "payment_transactions" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_unique" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_unique" ON "payments" USING btree ("provider","provider_payment_id") WHERE "payments"."provider_payment_id" is not null;--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_items_seller_order_unique" ON "payout_items" USING btree ("seller_order_id");--> statement-breakpoint
CREATE INDEX "payout_items_payout_idx" ON "payout_items" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "payouts_seller_idx" ON "payouts" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipment_tracking_shipment_idx" ON "shipment_tracking" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "shipments_seller_order_idx" ON "shipments" USING btree ("seller_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_tracking_unique" ON "shipments" USING btree ("courier","tracking_number") WHERE "shipments"."tracking_number" is not null;--> statement-breakpoint
CREATE INDEX "shipments_staff_idx" ON "shipments" USING btree ("assigned_staff_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_methods_code_unique" ON "shipping_methods" USING btree ("seller_id","code");--> statement-breakpoint
CREATE INDEX "bookmarks_user_time_idx" ON "bookmarks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id","created_at");--> statement-breakpoint
CREATE INDEX "likes_target_idx" ON "likes" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "post_media_post_idx" ON "post_media" USING btree ("post_id","position");--> statement-breakpoint
CREATE INDEX "posts_feed_idx" ON "posts" USING btree ("status","visibility","created_at");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_book_idx" ON "posts" USING btree ("book_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_student_idx" ON "posts" USING btree ("is_student_zone","created_at") WHERE "posts"."is_student_zone";--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_book_unique" ON "reviews" USING btree ("user_id","book_id") WHERE "reviews"."book_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_product_unique" ON "reviews" USING btree ("user_id","product_id") WHERE "reviews"."book_id" is null and "reviews"."product_id" is not null;--> statement-breakpoint
CREATE INDEX "reviews_book_idx" ON "reviews" USING btree ("book_id","status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "book_club_books_club_month_unique" ON "book_club_books" USING btree ("club_id","month");--> statement-breakpoint
CREATE INDEX "book_club_events_club_idx" ON "book_club_events" USING btree ("club_id","starts_at");--> statement-breakpoint
CREATE INDEX "book_club_members_user_idx" ON "book_club_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "book_club_poll_options_poll_idx" ON "book_club_poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "book_club_poll_votes_user_idx" ON "book_club_poll_votes" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE INDEX "book_club_polls_club_idx" ON "book_club_polls" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "book_club_posts_club_idx" ON "book_club_posts" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE INDEX "book_club_posts_parent_idx" ON "book_club_posts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "book_club_schedule_book_idx" ON "book_club_schedule" USING btree ("club_book_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "book_clubs_slug_unique" ON "book_clubs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "book_clubs_type_idx" ON "book_clubs" USING btree ("type","purpose");--> statement-breakpoint
CREATE INDEX "book_clubs_name_trgm_idx" ON "book_clubs" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "badges_key_unique" ON "badges" USING btree ("key");--> statement-breakpoint
CREATE INDEX "challenge_participants_user_idx" ON "challenge_participants" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "downloads_user_asset_idx" ON "downloads" USING btree ("user_id","digital_asset_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_challenges_slug_unique" ON "reading_challenges" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "reading_history_user_time_idx" ON "reading_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "reading_lists_user_idx" ON "reading_lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reading_sessions_user_day_idx" ON "reading_sessions" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "user_library_shelf_idx" ON "user_library" USING btree ("user_id","shelf","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_source_unique" ON "xp_events" USING btree ("user_id","source","source_id");--> statement-breakpoint
CREATE INDEX "xp_events_user_time_idx" ON "xp_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_entries_user_unique" ON "competition_entries" USING btree ("competition_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_slug_unique" ON "competitions" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_unique" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_idx" ON "quiz_attempts" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_quiz_idx" ON "quiz_attempts" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_quiz_idx" ON "quiz_questions" USING btree ("quiz_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quizzes_slug_unique" ON "quizzes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "quizzes_subject_idx" ON "quizzes" USING btree ("subject","academic_level");--> statement-breakpoint
CREATE UNIQUE INDEX "scholarships_slug_unique" ON "scholarships" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "scholarships_deadline_idx" ON "scholarships" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "user_notes_user_idx" ON "user_notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "notifications_user_time_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "outbound_messages_queue_idx" ON "outbound_messages" USING btree ("status","send_after");--> statement-breakpoint
CREATE INDEX "outbound_messages_recipient_idx" ON "outbound_messages" USING btree ("recipient","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "copyright_claims_status_idx" ON "copyright_claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "copyright_claims_target_idx" ON "copyright_claims" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_user_idx" ON "moderation_actions" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_queue_idx" ON "reports" USING btree ("status","priority","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_slug_unique" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "articles_listing_idx" ON "articles" USING btree ("kind","status","published_at");--> statement-breakpoint
CREATE INDEX "articles_title_trgm_idx" ON "articles" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "banners_placement_idx" ON "banners" USING btree ("placement","is_active","position");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_pages_slug_unique" ON "cms_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "faqs_category_idx" ON "faqs" USING btree ("category","position");--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_sections_key_unique" ON "homepage_sections" USING btree ("key");--> statement-breakpoint
CREATE INDEX "homepage_sections_order_idx" ON "homepage_sections" USING btree ("is_enabled","position");--> statement-breakpoint
CREATE INDEX "ai_usage_user_time_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_event_time_idx" ON "analytics_events" USING btree ("event","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_entity_idx" ON "analytics_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_seller_idx" ON "analytics_events" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","created_at");