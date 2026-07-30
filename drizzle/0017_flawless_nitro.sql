CREATE TYPE "public"."event_organizer_role" AS ENUM('owner', 'co_organizer');--> statement-breakpoint
CREATE TABLE "event_organizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "event_organizer_role" DEFAULT 'co_organizer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "post_registration_url" text;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_organizers_event_user_unique" ON "event_organizers" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_organizers_user_idx" ON "event_organizers" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "event_organizers" ("event_id", "user_id", "role")
SELECT "id", "created_by", 'owner' FROM "events"
ON CONFLICT DO NOTHING;
