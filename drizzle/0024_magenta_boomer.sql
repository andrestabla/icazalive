ALTER TABLE "audit_logs" ADD COLUMN "previous_hash" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "entry_hash" text;