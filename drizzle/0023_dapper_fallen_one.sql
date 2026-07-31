ALTER TABLE "communication_deliveries" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "communication_deliveries" ADD COLUMN "provider_id" text;