ALTER TABLE "api_keys" ADD COLUMN "name" text DEFAULT 'Default' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_four" text NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_used_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "revoked_at" timestamp;