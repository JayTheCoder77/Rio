CREATE TYPE "public"."model_provider" AS ENUM('groq', 'openrouter');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "model_provider" "model_provider";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "model_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "model_api_key_encrypted" text;