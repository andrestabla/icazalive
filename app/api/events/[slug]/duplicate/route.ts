import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  communicationMessages,
  eventOrganizers,
  eventPolls,
  eventRegistrationFields,
  eventResources,
  events,
  pollOptions,
  sessions,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { findScheduleConflicts } from "@/lib/event-scheduling";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

function createSlug(title: string) {
  const base =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "evento";
  return `${base}-${Date.now().toString(36)}`;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role === "participant") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { slug } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    startsAt?: string;
    allowConflict?: boolean;
  };
  const db = getDb();
  const [source] = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!source) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const title = body.title?.trim() || `${source.title} — copia`;
  const startsAt = body.startsAt
    ? new Date(body.startsAt)
    : new Date(source.startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const duration = source.endsAt.getTime() - source.startsAt.getTime();
  const endsAt = new Date(startsAt.getTime() + duration);
  if (
    title.length < 3 ||
    title.length > 180 ||
    Number.isNaN(startsAt.getTime())
  ) {
    return NextResponse.json(
      { error: "Revisa el nombre y la fecha del nuevo evento." },
      { status: 400 },
    );
  }

  const conflicts = await findScheduleConflicts({
    startsAt,
    endsAt,
    format: source.format,
    createdBy: user.id,
  });
  if (conflicts.length && body.allowConflict !== true) {
    return NextResponse.json(
      {
        error: "El horario coincide con otro evento o licencia Zoom.",
        conflicts,
        requiresConfirmation: true,
      },
      { status: 409 },
    );
  }

  const [
    sourceSessions,
    sourceMessages,
    sourcePolls,
    sourceResources,
    sourceRegistrationFields,
  ] =
    await Promise.all([
      db
        .select()
        .from(sessions)
        .where(eq(sessions.eventId, source.id))
        .orderBy(sessions.startsAt),
      db
        .select()
        .from(communicationMessages)
        .where(eq(communicationMessages.eventId, source.id)),
      db
        .select()
        .from(eventPolls)
        .where(eq(eventPolls.eventId, source.id)),
      db
        .select()
        .from(eventResources)
        .where(eq(eventResources.eventId, source.id))
        .orderBy(eventResources.position),
      db
        .select()
        .from(eventRegistrationFields)
        .where(eq(eventRegistrationFields.eventId, source.id))
        .orderBy(eventRegistrationFields.position),
    ]);
  const sourcePollIds = sourcePolls.map((poll) => poll.id);
  const sourceOptions = sourcePollIds.length
    ? await db
        .select()
        .from(pollOptions)
        .where(inArray(pollOptions.pollId, sourcePollIds))
        .orderBy(pollOptions.position)
    : [];
  const offset = startsAt.getTime() - source.startsAt.getTime();

  const duplicated = await db.transaction(async (transaction) => {
    const [event] = await transaction
      .insert(events)
      .values({
        title,
        slug: createSlug(title),
        description: source.description,
        format: source.format,
        status: "draft",
        timezone: source.timezone,
        startsAt,
        endsAt,
        maxAttendees: source.maxAttendees,
        registrationOpen: false,
        createdBy: user.id,
      })
      .returning();

    await transaction.insert(eventOrganizers).values({
      eventId: event.id,
      userId: user.id,
      role: "owner",
    });

    if (sourceSessions.length) {
      await transaction.insert(sessions).values(
        sourceSessions.map((session) => ({
          eventId: event.id,
          title: session.title,
          startsAt: new Date(session.startsAt.getTime() + offset),
          endsAt: new Date(session.endsAt.getTime() + offset),
          streamingMode: session.streamingMode,
          streamingStatus: "not_configured" as const,
          latencyMode: session.latencyMode,
          recordingEnabled: session.recordingEnabled,
        })),
      );
    }
    if (sourceMessages.length) {
      await transaction.insert(communicationMessages).values(
        sourceMessages.map((message) => ({
          eventId: event.id,
          type: message.type,
          subject: message.subject,
          body: message.body,
          enabled: message.enabled,
          offsetMinutes: message.offsetMinutes,
        })),
      );
    }
    if (sourceResources.length) {
      await transaction.insert(eventResources).values(
        sourceResources.map((resource) => ({
          eventId: event.id,
          title: resource.title,
          url: resource.url,
          kind: resource.kind,
          visible: resource.visible,
          position: resource.position,
          createdBy: user.id,
        })),
      );
    }
    if (sourceRegistrationFields.length) {
      await transaction.insert(eventRegistrationFields).values(
        sourceRegistrationFields.map((field) => ({
          eventId: event.id,
          fieldKey: field.fieldKey,
          label: field.label,
          type: field.type,
          placeholder: field.placeholder,
          helpText: field.helpText,
          required: field.required,
          options: field.options,
          active: field.active,
          position: field.position,
        })),
      );
    }
    for (const sourcePoll of sourcePolls) {
      const [poll] = await transaction
        .insert(eventPolls)
        .values({
          eventId: event.id,
          question: sourcePoll.question,
          status: "draft",
          anonymous: sourcePoll.anonymous,
        })
        .returning();
      const options = sourceOptions.filter(
        (option) => option.pollId === sourcePoll.id,
      );
      if (options.length) {
        await transaction.insert(pollOptions).values(
          options.map((option) => ({
            pollId: poll.id,
            label: option.label,
            position: option.position,
          })),
        );
      }
    }
    return event;
  });

  await writeAuditLog({
    actor: user,
    action: "event.duplicated",
    resourceType: "event",
    resourceId: duplicated.id,
    summary: `Evento “${source.title}” duplicado como “${duplicated.title}”.`,
    details: {
      sourceEventId: source.id,
      startsAt: duplicated.startsAt.toISOString(),
      copiedSessions: sourceSessions.length,
      copiedCommunications: sourceMessages.length,
      copiedPolls: sourcePolls.length,
      copiedResources: sourceResources.length,
      copiedRegistrationFields: sourceRegistrationFields.length,
      conflictOverride: conflicts.length > 0,
    },
    request,
  });

  return NextResponse.json(
    { data: { ...duplicated, conflicts } },
    { status: 201 },
  );
}
