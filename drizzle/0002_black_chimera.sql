ALTER TABLE "registrations" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "consent_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "source" text DEFAULT 'registration_page' NOT NULL;