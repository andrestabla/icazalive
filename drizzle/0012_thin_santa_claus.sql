CREATE TYPE "public"."data_request_status" AS ENUM('submitted', 'verified', 'in_progress', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."data_request_type" AS ENUM('access', 'correction', 'deletion', 'portability', 'restriction');--> statement-breakpoint
CREATE TYPE "public"."legal_document_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."legal_document_type" AS ENUM('privacy', 'terms');--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid,
	"participant_id" uuid,
	"event_id" uuid,
	"privacy_document_id" uuid NOT NULL,
	"terms_document_id" uuid NOT NULL,
	"privacy_version" integer NOT NULL,
	"terms_version" integer NOT NULL,
	"subject_email_hash" text NOT NULL,
	"privacy_accepted" boolean DEFAULT true NOT NULL,
	"marketing_accepted" boolean DEFAULT false NOT NULL,
	"consent_text" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_subject_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"type" "data_request_type" NOT NULL,
	"description" text,
	"status" "data_request_status" DEFAULT 'submitted' NOT NULL,
	"identity_verified" boolean DEFAULT false NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"consent_accepted_at" timestamp with time zone NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"assigned_to" uuid,
	"resolution_notes" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "legal_document_type" NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"status" "legal_document_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_privacy_document_id_legal_documents_id_fk" FOREIGN KEY ("privacy_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_terms_document_id_legal_documents_id_fk" FOREIGN KEY ("terms_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_records_registration_idx" ON "consent_records" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "consent_records_event_idx" ON "consent_records" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "consent_records_accepted_idx" ON "consent_records" USING btree ("accepted_at");--> statement-breakpoint
CREATE INDEX "data_subject_requests_email_idx" ON "data_subject_requests" USING btree ("requester_email");--> statement-breakpoint
CREATE INDEX "data_subject_requests_status_idx" ON "data_subject_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_subject_requests_due_idx" ON "data_subject_requests" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_type_version_unique" ON "legal_documents" USING btree ("type","version");--> statement-breakpoint
CREATE INDEX "legal_documents_status_idx" ON "legal_documents" USING btree ("status");