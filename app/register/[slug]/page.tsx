import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { eventRegistrationFields, events } from "@/db/schema";
import { getBrandSettings } from "@/lib/brand";
import { applyEventBrand } from "@/lib/brand-config";
import { getPublishedLegalDocuments } from "@/lib/privacy";
import RegistrationForm from "./registration-form";

export const dynamic = "force-dynamic";

export default async function PublicRegistrationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [[event], brand, legalDocuments] = await Promise.all([
    getDb()
      .select({
        id: events.id,
        title: events.title,
        slug: events.slug,
        description: events.description,
        format: events.format,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        timezone: events.timezone,
        registrationOpen: events.registrationOpen,
        postRegistrationUrl: events.postRegistrationUrl,
        brandPrimaryColor: events.brandPrimaryColor,
        brandAccentColor: events.brandAccentColor,
        brandBackgroundColor: events.brandBackgroundColor,
      })
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1),
    getBrandSettings(),
    getPublishedLegalDocuments(),
  ]);

  if (!event) notFound();
  const fields = await getDb()
    .select()
    .from(eventRegistrationFields)
    .where(
      and(
        eq(eventRegistrationFields.eventId, event.id),
        eq(eventRegistrationFields.active, true),
      ),
    )
    .orderBy(
      asc(eventRegistrationFields.position),
      asc(eventRegistrationFields.createdAt),
    );

  return (
    <RegistrationForm
      event={{
        ...event,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
      }}
      brand={applyEventBrand(brand, event)}
      fields={fields}
      legalDocuments={{
        privacy: {
          id: legalDocuments.privacy.id,
          title: legalDocuments.privacy.title,
          version: legalDocuments.privacy.version,
        },
        terms: {
          id: legalDocuments.terms.id,
          title: legalDocuments.terms.title,
          version: legalDocuments.terms.version,
        },
      }}
    />
  );
}
