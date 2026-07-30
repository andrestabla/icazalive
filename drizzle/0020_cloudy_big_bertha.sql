ALTER TABLE "events" ADD COLUMN "recorded_video_path" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recorded_video_name" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recorded_video_size" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recorded_video_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recorded_video_uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "post_event_redirect_url" text;