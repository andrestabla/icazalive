CREATE TABLE "outbound_email_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"provider" text DEFAULT 'smtp' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"from_name" text,
	"from_email" text,
	"reply_to" text,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"smtp_username" text,
	"smtp_password_encrypted" text,
	"region" text,
	"configuration_set" text,
	"last_tested_at" timestamp with time zone,
	"last_test_ok" boolean,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_email_settings" ADD CONSTRAINT "outbound_email_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;