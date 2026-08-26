ALTER TABLE "sessions" ADD COLUMN "zoom_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "zoom_duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "zoom_timezone" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "zoom_synced_at" timestamp with time zone;