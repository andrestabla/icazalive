CREATE TYPE "public"."registration_field_type" AS ENUM('text', 'textarea', 'select', 'checkbox');--> statement-breakpoint
CREATE TABLE "event_registration_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"type" "registration_field_type" DEFAULT 'text' NOT NULL,
	"placeholder" text,
	"help_text" text,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_field_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_registration_fields" ADD CONSTRAINT "event_registration_fields_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_field_responses" ADD CONSTRAINT "registration_field_responses_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_field_responses" ADD CONSTRAINT "registration_field_responses_field_id_event_registration_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."event_registration_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registration_fields_event_key_unique" ON "event_registration_fields" USING btree ("event_id","field_key");--> statement-breakpoint
CREATE INDEX "event_registration_fields_event_position_idx" ON "event_registration_fields" USING btree ("event_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_field_responses_registration_field_unique" ON "registration_field_responses" USING btree ("registration_id","field_id");--> statement-breakpoint
CREATE INDEX "registration_field_responses_field_idx" ON "registration_field_responses" USING btree ("field_id");