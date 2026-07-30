ALTER TYPE "public"."integration_status" ADD VALUE 'configured' BEFORE 'connected';--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "region" text;