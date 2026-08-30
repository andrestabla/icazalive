CREATE TYPE "public"."emitter_status" AS ENUM('idle', 'starting', 'running', 'stopping', 'stopped', 'error');--> statement-breakpoint
CREATE TYPE "public"."simulated_delivery" AS ENUM('direct', 'streaming');--> statement-breakpoint
CREATE TABLE "content_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"s3_key" text NOT NULL,
	"size_bytes" integer,
	"duration_seconds" integer,
	"content_type" text DEFAULT 'video/mp4' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_assets_s3_key_unique" UNIQUE("s3_key")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "content_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "simulated_delivery" "simulated_delivery" DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "hybrid_switch_offset_minutes" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "emitter_status" "emitter_status" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "emitter_task_arn" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "emitter_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_assets_created_idx" ON "content_assets" USING btree ("created_at");