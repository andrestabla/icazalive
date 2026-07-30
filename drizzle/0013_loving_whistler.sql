CREATE TYPE "public"."chat_channel" AS ENUM('public', 'backstage');--> statement-breakpoint
CREATE TYPE "public"."chat_message_status" AS ENUM('visible', 'removed');--> statement-breakpoint
CREATE TYPE "public"."event_resource_kind" AS ENUM('link', 'file');--> statement-breakpoint
CREATE TABLE "event_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_id" uuid,
	"author_user_id" uuid,
	"author_name" text NOT NULL,
	"channel" "chat_channel" DEFAULT 'public' NOT NULL,
	"message" text NOT NULL,
	"status" "chat_message_status" DEFAULT 'visible' NOT NULL,
	"removed_by" uuid,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_participant_moderation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"muted_until" timestamp with time zone,
	"blocked" boolean DEFAULT false NOT NULL,
	"reason" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"reaction" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"kind" "event_resource_kind" DEFAULT 'link' NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_chat_messages" ADD CONSTRAINT "event_chat_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_messages" ADD CONSTRAINT "event_chat_messages_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_messages" ADD CONSTRAINT "event_chat_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_messages" ADD CONSTRAINT "event_chat_messages_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participant_moderation" ADD CONSTRAINT "event_participant_moderation_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participant_moderation" ADD CONSTRAINT "event_participant_moderation_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participant_moderation" ADD CONSTRAINT "event_participant_moderation_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reactions" ADD CONSTRAINT "event_reactions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reactions" ADD CONSTRAINT "event_reactions_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_resources" ADD CONSTRAINT "event_resources_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_resources" ADD CONSTRAINT "event_resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_chat_messages_event_channel_created_idx" ON "event_chat_messages" USING btree ("event_id","channel","created_at");--> statement-breakpoint
CREATE INDEX "event_chat_messages_registration_idx" ON "event_chat_messages" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_participant_moderation_event_registration_unique" ON "event_participant_moderation" USING btree ("event_id","registration_id");--> statement-breakpoint
CREATE INDEX "event_participant_moderation_event_idx" ON "event_participant_moderation" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_reactions_event_created_idx" ON "event_reactions" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "event_reactions_registration_idx" ON "event_reactions" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_resources_event_url_unique" ON "event_resources" USING btree ("event_id","url");--> statement-breakpoint
CREATE INDEX "event_resources_event_visible_position_idx" ON "event_resources" USING btree ("event_id","visible","position");