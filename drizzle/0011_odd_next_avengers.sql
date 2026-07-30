CREATE TYPE "public"."help_language" AS ENUM('es', 'en', 'fr');--> statement-breakpoint
CREATE TYPE "public"."support_request_status" AS ENUM('new', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_user_id" uuid,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"language" "help_language" DEFAULT 'es' NOT NULL,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"event_title" text,
	"event_date" timestamp with time zone,
	"event_url" text,
	"affected_email" text,
	"screenshot_url" text,
	"status" "support_request_status" DEFAULT 'new' NOT NULL,
	"consent_accepted_at" timestamp with time zone NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_requests_email_idx" ON "support_requests" USING btree ("requester_email");--> statement-breakpoint
CREATE INDEX "support_requests_status_idx" ON "support_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_requests_created_idx" ON "support_requests" USING btree ("created_at");