import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import {
  createZoomMeeting,
  deleteZoomMeeting,
  updateZoomMeeting,
} from "@/lib/zoom";
import { canManageEvent } from "@/lib/event-permissions";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

async function requireStaff() {
  const user = await requireApiUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (user.role === "participant") {
    return {
      error: NextResponse.json({ error: "No autorizado." }, { status: 403 }),
    };
  }
  return { user };
}

function cleanTitle(value: unknown) {
  if (typeof value !== "string") throw new Error("invalid");
  const title = value.trim().replace(/\s+/g, " ");
  if (title.length < 2 || title.length > 120) throw new Error("invalid");
  return title;
}

function cleanSchedule(startsAtValue: unknown, endsAtValue: unknown) {
  if (typeof startsAtValue !== "string" || typeof endsAtValue !== "string") {
    throw new Error("invalid");
  }
  const startsAt = new Date(startsAtValue);
  const endsAt = new Date(endsAtValue);
  const duration = endsAt.getTime() - startsAt.getTime();
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    duration < 5 * 60 * 1000 ||
    duration > 12 * 60 * 60 * 1000
  ) {
    throw new Error("invalid");
  }
  return { startsAt, endsAt };
}

async function findEvent(slug: string) {
  const [event] = await getDb()
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  return event;
}

function scheduleFitsEvent(
  schedule: { startsAt: Date; endsAt: Date },
  event: { startsAt: Date; endsAt: Date },
) {
  return (
    schedule.startsAt.getTime() >= event.startsAt.getTime() &&
    schedule.endsAt.getTime() <= event.endsAt.getTime()
  );
}

function usesZoom(streamingMode: string) {
  return streamingMode === "zoom_to_ivs" || streamingMode === "zoom_only";
}

function zoomSyncError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "No fue posible sincronizar la reunión de Zoom.";
}

async function hasDuplicateTitle(
  eventId: string,
  title: string,
  ignoredSessionId?: string,
) {
  const records = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.eventId, eventId),
        eq(sessions.title, title),
      ),
    )
    .limit(1);
  return Boolean(records[0] && records[0].id !== ignoredSessionId);
}

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const event = await findEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (!(await canManageEvent(auth.user, event.id))) {
    return NextResponse.json(
      { error: "No eres organizador de este evento." },
      { status: 403 },
    );
  }

  const records = await getDb()
    .select()
    .from(sessions)
    .where(eq(sessions.eventId, event.id))
    .orderBy(sessions.startsAt);

  return NextResponse.json({ data: records });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    startsAt?: string;
    endsAt?: string;
    createZoomMeeting?: boolean;
  };
  if (
    body.createZoomMeeting !== undefined &&
    typeof body.createZoomMeeting !== "boolean"
  ) {
    return NextResponse.json(
      { error: "La opción de Zoom no es válida." },
      { status: 400 },
    );
  }

  let title: string;
  let schedule: { startsAt: Date; endsAt: Date };
  try {
    title = cleanTitle(body.title);
    schedule = cleanSchedule(body.startsAt, body.endsAt);
  } catch {
    return NextResponse.json(
      {
        error:
          "Revisa el nombre y el horario. La sesión debe durar entre 5 minutos y 12 horas.",
      },
      { status: 400 },
    );
  }

  const event = await findEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (!(await canManageEvent(auth.user, event.id))) {
    return NextResponse.json(
      { error: "No eres organizador de este evento." },
      { status: 403 },
    );
  }
  if (!scheduleFitsEvent(schedule, event)) {
    return NextResponse.json(
      { error: "La sesión debe comenzar y finalizar dentro del horario del evento." },
      { status: 400 },
    );
  }
  if (await hasDuplicateTitle(event.id, title)) {
    return NextResponse.json(
      { error: "Ya existe una sesión con ese nombre en el evento." },
      { status: 409 },
    );
  }

  const streamingMode =
    event.format === "simulated" ? "simulated" : "zoom_to_ivs";
  const shouldCreateZoomMeeting =
    body.createZoomMeeting ?? usesZoom(streamingMode);
  if (shouldCreateZoomMeeting && event.format === "simulated") {
    return NextResponse.json(
      { error: "Los eventos simulados no necesitan una reunión de Zoom." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [createdRecord] = await db
    .insert(sessions)
    .values({ eventId: event.id, title, ...schedule, streamingMode })
    .returning();
  let created = createdRecord;
  let zoomWarning: string | undefined;
  if (shouldCreateZoomMeeting) {
    try {
      const meeting = await createZoomMeeting({
        topic: created.title,
        startsAt: created.startsAt,
        endsAt: created.endsAt,
        timezone: event.timezone,
        agenda: event.title,
      });
      [created] = await db
        .update(sessions)
        .set({
          zoomMeetingId: meeting.id,
          zoomJoinUrl: meeting.joinUrl,
          zoomStartAt: meeting.startAt,
          zoomDurationMinutes: meeting.durationMinutes,
          zoomTimezone: meeting.timezone ?? event.timezone,
          zoomSyncedAt: new Date(),
          zoomManagedByIcaza: true,
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, created.id))
        .returning();
    } catch (error) {
      zoomWarning = zoomSyncError(error);
    }
  }

  await writeAuditLog({
    actor: auth.user,
    action: "session.created",
    resourceType: "session",
    resourceId: created.id,
    summary: `Sesión “${created.title}” creada en “${event.title}”.`,
    details: {
      eventId: event.id,
      startsAt: created.startsAt.toISOString(),
      endsAt: created.endsAt.toISOString(),
      zoomMeetingId: created.zoomMeetingId,
      zoomWarning: zoomWarning ?? null,
    },
    request,
  });
  return NextResponse.json(
    {
      data: created,
      ...(zoomWarning
        ? {
            warning: `La sesión se creó, pero la reunión de Zoom quedó pendiente: ${zoomWarning}`,
          }
        : {}),
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    startsAt?: string;
    endsAt?: string;
    createZoomMeeting?: boolean;
    syncZoom?: boolean;
  };
  if (
    (body.createZoomMeeting !== undefined &&
      typeof body.createZoomMeeting !== "boolean") ||
    (body.syncZoom !== undefined && typeof body.syncZoom !== "boolean")
  ) {
    return NextResponse.json(
      { error: "La opción de Zoom no es válida." },
      { status: 400 },
    );
  }
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 400 });
  }

  let title: string;
  let schedule: { startsAt: Date; endsAt: Date };
  try {
    title = cleanTitle(body.title);
    schedule = cleanSchedule(body.startsAt, body.endsAt);
  } catch {
    return NextResponse.json(
      {
        error:
          "Revisa el nombre y el horario. La sesión debe durar entre 5 minutos y 12 horas.",
      },
      { status: 400 },
    );
  }

  const event = await findEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (!(await canManageEvent(auth.user, event.id))) {
    return NextResponse.json(
      { error: "No eres organizador de este evento." },
      { status: 403 },
    );
  }
  const [target] = await getDb()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.eventId, event.id),
        eq(sessions.id, body.id),
      ),
    )
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
  }
  if (!scheduleFitsEvent(schedule, event)) {
    return NextResponse.json(
      { error: "La sesión debe comenzar y finalizar dentro del horario del evento." },
      { status: 400 },
    );
  }
  if (await hasDuplicateTitle(event.id, title, target.id)) {
    return NextResponse.json(
      { error: "Ya existe una sesión con ese nombre en el evento." },
      { status: 409 },
    );
  }

  const scheduleChanged =
    target.startsAt.getTime() !== schedule.startsAt.getTime() ||
    target.endsAt.getTime() !== schedule.endsAt.getTime();
  const shouldSyncZoom = body.syncZoom ?? usesZoom(target.streamingMode);
  const shouldCreateZoomMeeting =
    body.createZoomMeeting ??
    (usesZoom(target.streamingMode) && !target.zoomMeetingId);
  if (shouldCreateZoomMeeting && event.format === "simulated") {
    return NextResponse.json(
      { error: "Los eventos simulados no necesitan una reunión de Zoom." },
      { status: 400 },
    );
  }
  let zoomUpdate:
    | Awaited<ReturnType<typeof createZoomMeeting>>
    | Awaited<ReturnType<typeof updateZoomMeeting>>
    | undefined;
  if (shouldSyncZoom && target.zoomMeetingId) {
    if (!target.zoomManagedByIcaza) {
      return NextResponse.json(
        {
          error:
            "Esta reunión no fue creada por Icaza Live y no se puede sincronizar.",
        },
        { status: 400 },
      );
    }
    try {
      zoomUpdate = await updateZoomMeeting({
        meetingId: target.zoomMeetingId,
        topic: title,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        timezone: event.timezone,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: `La sesión no se actualizó porque Zoom no pudo sincronizar la reunión: ${zoomSyncError(error)}`,
        },
        { status: 502 },
      );
    }
  } else if (shouldCreateZoomMeeting && !target.zoomMeetingId) {
    try {
      zoomUpdate = await createZoomMeeting({
        topic: title,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        timezone: event.timezone,
        agenda: event.title,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: `La sesión no se actualizó porque Zoom no pudo crear la reunión: ${zoomSyncError(error)}`,
        },
        { status: 502 },
      );
    }
  }
  const now = new Date();
  const [updated] = await getDb()
    .update(sessions)
    .set({
      title,
      ...schedule,
      ...(scheduleChanged
        ? {
            streamingStatus: "not_configured" as const,
            technicalCheckAt: null,
          }
        : {}),
      ...(zoomUpdate
        ? {
            zoomMeetingId: zoomUpdate.id,
            zoomJoinUrl: zoomUpdate.joinUrl ?? target.zoomJoinUrl,
            zoomStartAt: zoomUpdate.startAt,
            zoomDurationMinutes: zoomUpdate.durationMinutes,
            zoomTimezone: zoomUpdate.timezone ?? event.timezone,
            zoomSyncedAt: now,
            zoomManagedByIcaza: true,
          }
        : {}),
      updatedAt: now,
    })
    .where(eq(sessions.id, target.id))
    .returning();

  await writeAuditLog({
    actor: auth.user,
    action: "session.updated",
    resourceType: "session",
    resourceId: updated.id,
    summary: `Sesión “${updated.title}” actualizada en “${event.title}”.`,
    details: {
      eventId: event.id,
      scheduleChanged,
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt.toISOString(),
      zoomMeetingId: updated.zoomMeetingId,
    },
    request,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const body = (await request.json()) as { id?: string };
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 400 });
  }

  const event = await findEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (!(await canManageEvent(auth.user, event.id))) {
    return NextResponse.json(
      { error: "No eres organizador de este evento." },
      { status: 403 },
    );
  }
  const [target, total] = await Promise.all([
    getDb()
      .select({ id: sessions.id, title: sessions.title })
      .from(sessions)
      .where(
        and(
          eq(sessions.eventId, event.id),
          eq(sessions.id, body.id),
        ),
      )
      .limit(1),
    getDb()
      .select({ value: count() })
      .from(sessions)
      .where(eq(sessions.eventId, event.id)),
  ]);
  if (!target[0]) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
  }
  if ((total[0]?.value ?? 0) <= 1) {
    return NextResponse.json(
      { error: "El evento debe conservar al menos una sesión." },
      { status: 409 },
    );
  }

  const [sessionToDelete] = await getDb()
    .select({
      id: sessions.id,
      zoomMeetingId: sessions.zoomMeetingId,
      zoomManagedByIcaza: sessions.zoomManagedByIcaza,
    })
    .from(sessions)
    .where(eq(sessions.id, target[0].id))
    .limit(1);
  if (
    sessionToDelete?.zoomMeetingId &&
    sessionToDelete.zoomManagedByIcaza
  ) {
    try {
      await deleteZoomMeeting(sessionToDelete.zoomMeetingId);
    } catch (error) {
      return NextResponse.json(
        {
          error: `La sesión no se eliminó porque Zoom no pudo retirar la reunión asociada: ${zoomSyncError(error)}`,
        },
        { status: 502 },
      );
    }
  }

  await getDb().delete(sessions).where(eq(sessions.id, target[0].id));
  await writeAuditLog({
    actor: auth.user,
    action: "session.deleted",
    resourceType: "session",
    resourceId: target[0].id,
    summary: `Sesión “${target[0].title}” eliminada de “${event.title}”.`,
    details: { eventId: event.id },
    request,
  });
  return NextResponse.json({ data: { id: target[0].id } });
}
