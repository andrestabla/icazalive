CREATE TYPE "public"."identity_protocol" AS ENUM('oidc', 'saml');--> statement-breakpoint
CREATE TYPE "public"."mfa_method" AS ENUM('totp', 'webauthn', 'email');--> statement-breakpoint
CREATE TYPE "public"."mfa_policy" AS ENUM('optional', 'required_admins', 'required_all');--> statement-breakpoint
CREATE TABLE "identity_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "integration_status" DEFAULT 'pending' NOT NULL,
	"provider_name" text,
	"protocol" "identity_protocol" DEFAULT 'oidc' NOT NULL,
	"organization_domain" text,
	"issuer_url" text,
	"client_id" text,
	"entity_id" text,
	"mfa_policy" "mfa_policy" DEFAULT 'required_admins' NOT NULL,
	"mfa_method" "mfa_method" DEFAULT 'totp' NOT NULL,
	"recovery_codes_required" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identity_settings" ADD CONSTRAINT "identity_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;