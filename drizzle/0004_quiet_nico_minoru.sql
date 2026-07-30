CREATE TYPE "public"."streaming_latency" AS ENUM('low', 'standard');--> statement-breakpoint
CREATE TYPE "public"."streaming_mode" AS ENUM('zoom_only', 'zoom_to_ivs', 'ivs_direct', 'simulated');--> statement-breakpoint
CREATE TYPE "public"."streaming_status" AS ENUM('not_configured', 'configured', 'ready', 'live', 'ended', 'error');--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "streaming_mode" "streaming_mode" DEFAULT 'zoom_to_ivs' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "streaming_status" "streaming_status" DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "latency_mode" "streaming_latency" DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "zoom_join_url" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "recording_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "technical_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;