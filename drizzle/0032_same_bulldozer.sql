ALTER TABLE "events" ALTER COLUMN "simulated_delivery" SET DEFAULT 'streaming';--> statement-breakpoint
UPDATE "events" SET "simulated_delivery" = 'streaming' WHERE "simulated_delivery" = 'direct';
