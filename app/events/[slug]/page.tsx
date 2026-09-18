import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ensureMessageOfType } from "@/lib/communication-backfill";
import { getDb } from "@/db";
import {
  communicationDeliveries,
  communicationMessages,
  events,
  integrationConnections,
  registrations,
  sessions,
} from "@/db/schema";
import {
  evaluateStreamingConfiguration,
  getCredentialAvailability,
} from "@/lib/streaming";
import { checkZoomConnection } from "@/lib/zoom";
import EventDetail from "./event-detail";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) notFound();
  // Eventos creados antes de esta automatización reciben su plantilla (pausada).
  await ensureMessageOfType(event.id, "no_show_followup");

  const [
    sessionRecords,
    registrationResult,
    integrations,
    communications,
    deliveryStats,
    zoomCheck,
  ] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.eventId, event.id)).orderBy(sessions.startsAt),
    db.select({ total: count() }).from(registrations).where(eq(registrations.eventId, event.id)),
    db.select({
      provider: integrationConnections.provider,
      status: integrationConnections.status,
      accountLabel: integrationConnections.accountLabel,
    }).from(integrationConnections),
    db
      .select()
      .from(communicationMessages)
      .where(eq(communicationMessages.eventId, event.id))
      .orderBy(communicationMessages.createdAt),
    db
      .select({ status: communicationDeliveries.status, total: count() })
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.eventId, event.id))
      .groupBy(communicationDeliveries.status),
    checkZoomConnection(),
  ]);
  const credentials = getCredentialAvailability(zoomCheck.ok);
  const mainSession = sessionRecords[0];
  const streamingChecks = mainSession
    ? evaluateStreamingConfiguration({
        mode: mainSession.streamingMode,
        startsAt: mainSession.startsAt,
        endsAt: mainSession.endsAt,
        zoomMeetingId: mainSession.zoomMeetingId,
        zoomJoinUrl: mainSession.zoomJoinUrl,
        ivsChannelArn: mainSession.ivsChannelArn,
        playbackUrl: mainSession.playbackUrl,
        ...credentials,
      })
    : [];

  return (
    <EventDetail
      initialEvent={{
        ...event,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      }}
      sessions={sessionRecords.map((session) => ({
        ...session,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        technicalCheckAt: session.technicalCheckAt?.toISOString() ?? null,
        zoomStartAt: session.zoomStartAt?.toISOString() ?? null,
        zoomSyncedAt: session.zoomSyncedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      }))}
      registrationCount={registrationResult[0]?.total ?? 0}
      integrations={integrations}
      communications={communications.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      }))}
      deliveryStats={deliveryStats}
      streamingChecks={streamingChecks}
      streamingCredentials={credentials}
    />
  );
}
