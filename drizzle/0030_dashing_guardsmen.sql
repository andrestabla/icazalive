ALTER TABLE "events" ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';--> statement-breakpoint
UPDATE "events" SET "timezone" = 'America/New_York' WHERE "timezone" = 'America/Bogota';