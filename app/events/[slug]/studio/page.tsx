import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";
import {
  evaluateStreamingConfiguration,
  getCredentialAvailability,
} from "@/lib/streaming";
import StudioClient from "./studio-client";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();
  const [record] = await db
    .select({ event: events, session: sessions })
    .from(events)
    .innerJoin(sessions, eq(sessions.eventId, events.id))
    .where(eq(events.slug, slug))
    .orderBy(sessions.startsAt)
    .limit(1);

  if (!record) notFound();

  const credentials = getCredentialAvailability();
  const checks = evaluateStreamingConfiguration({
    mode: record.session.streamingMode,
    startsAt: record.session.startsAt,
    endsAt: record.session.endsAt,
    zoomMeetingId: record.session.zoomMeetingId,
    zoomJoinUrl: record.session.zoomJoinUrl,
    ivsChannelArn: record.session.ivsChannelArn,
    playbackUrl: record.session.playbackUrl,
    ...credentials,
  });

  return (
    <StudioClient
      event={{
        title: record.event.title,
        slug: record.event.slug,
        timezone: record.event.timezone,
        status: record.event.status,
        format: record.event.format,
      }}
      session={{
        id: record.session.id,
        title: record.session.title,
        startsAt: record.session.startsAt.toISOString(),
        streamingMode: record.session.streamingMode,
        streamingStatus: record.session.streamingStatus,
        zoomMeetingId: record.session.zoomMeetingId,
        ivsChannelArn: record.session.ivsChannelArn,
        playbackUrl: record.session.playbackUrl,
        emitterStatus: record.session.emitterStatus,
        technicalCheckAt:
          record.session.technicalCheckAt?.toISOString() ?? null,
      }}
      initialChecks={checks}
    />
  );
}
