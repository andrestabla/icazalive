CREATE TYPE "public"."communication_status" AS ENUM('queued', 'scheduled', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."communication_type" AS ENUM('registration_confirmation', 'reminder_24h', 'reminder_1h', 'post_event');--> statement-breakpoint
CREATE TABLE "communication_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"message_id" uuid,
	"type" "communication_type" NOT NULL,
	"status" "communication_status" DEFAULT 'scheduled' NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"type" "communication_type" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"offset_minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communication_deliveries" ADD CONSTRAINT "communication_deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_deliveries" ADD CONSTRAINT "communication_deliveries_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_deliveries" ADD CONSTRAINT "communication_deliveries_message_id_communication_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."communication_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communication_deliveries_registration_type_unique" ON "communication_deliveries" USING btree ("registration_id","type");--> statement-breakpoint
CREATE INDEX "communication_deliveries_event_idx" ON "communication_deliveries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "communication_deliveries_status_schedule_idx" ON "communication_deliveries" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_messages_event_type_unique" ON "communication_messages" USING btree ("event_id","type");