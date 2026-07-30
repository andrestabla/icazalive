CREATE TABLE "brand_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_name" text DEFAULT 'Icaza Live' NOT NULL,
	"mark_text" text DEFAULT 'I' NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#24194F' NOT NULL,
	"accent_color" text DEFAULT '#6946E8' NOT NULL,
	"background_color" text DEFAULT '#FBFAFC' NOT NULL,
	"registration_button_label" text DEFAULT 'Confirmar mi registro' NOT NULL,
	"footer_text" text DEFAULT 'Tus datos están protegidos' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_settings" ADD CONSTRAINT "brand_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;