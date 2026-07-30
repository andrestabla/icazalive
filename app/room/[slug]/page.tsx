import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { getBrandSettings } from "@/lib/brand";
import { applyEventBrand } from "@/lib/brand-config";
import RoomClient from "./room-client";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { slug } = await params;
  const { access } = await searchParams;
  const [[event], brand] = await Promise.all([
    getDb()
      .select({
        title: events.title,
        slug: events.slug,
        startsAt: events.startsAt,
        timezone: events.timezone,
        brandPrimaryColor: events.brandPrimaryColor,
        brandAccentColor: events.brandAccentColor,
        brandBackgroundColor: events.brandBackgroundColor,
      })
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1),
    getBrandSettings(),
  ]);
  if (!event) notFound();

  return (
    <RoomClient
      accessToken={access ?? null}
      eventShell={{
        ...event,
        startsAt: event.startsAt.toISOString(),
      }}
      brand={applyEventBrand(brand, event)}
    />
  );
}
