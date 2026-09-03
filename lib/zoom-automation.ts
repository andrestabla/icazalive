import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import type { AuthenticatedUser } from "@/lib/auth";
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeeting } from "@/lib/zoom";

// Automatización de Zoom para eventos en vivo e híbridos: al confirmar el
// evento (sale de borrador) se crea la reunión programada en Zoom con la fecha
// y hora del evento; al mover la fecha se actualiza; al cancelar se elimina.
// Nunca lanza: los fallos quedan en auditoría para que el equipo los vea.

type Options = { actor?: AuthenticatedUser | null; request?: Request };

async function loadEventWithMainSession(eventId: string) {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return null;
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.eventId, eventId))
    .orderBy(asc(sessions.startsAt))
    .limit(1);
  return session ? { event, session } : null;
}

function usesZoom(format: string, streamingMode: string) {
  return (
    (format === "live" || format === "hybrid") &&
    (streamingMode === "zoom_only" || streamingMode === "zoom_to_ivs")
  );
}

export async function ensureZoomMeetingForEvent(eventId: string, options: Options = {}) {
  const record = await loadEventWithMainSession(eventId);
  if (!record) return { ok: false as const, reason: "not_found" as const };
  const { event, session } = record;
  if (!usesZoom(event.format, session.streamingMode)) return { ok: true as const, skipped: "no_zoom" as const };
  if (session.zoomMeetingId) return { ok: true as const, skipped: "exists" as const };
  if (event.status === "cancelled" || event.status === "completed") return { ok: true as const, skipped: "final" as const };

  try {
    const meeting = await createZoomMeeting({
      topic: event.title,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      timezone: event.timezone,
      agenda: event.description ?? undefined,
    });
    await getDb()
      .update(sessions)
      .set({
        zoomMeetingId: meeting.id,
        zoomJoinUrl: meeting.joinUrl,
        streamingStatus: session.streamingStatus === "not_configured" ? "configured" : session.streamingStatus,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));
    await writeAuditLog({
      actor: options.actor ?? undefined,
      action: "zoom.meeting.created",
      resourceType: "session",
      resourceId: session.id,
      summary: `Reunión de Zoom ${meeting.id} creada automáticamente para “${event.title}”.`,
      details: { meetingId: meeting.id, startsAt: session.startsAt.toISOString() },
      request: options.request,
    });
    return { ok: true as const, meetingId: meeting.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    await writeAuditLog({
      actor: options.actor ?? undefined,
      action: "zoom.meeting.failed",
      resourceType: "session",
      resourceId: session.id,
      outcome: "failure",
      summary: `No se pudo crear la reunión de Zoom de “${event.title}”: ${message}`,
      request: options.request,
    });
    console.error("[zoom] crear reunión", message);
    return { ok: false as const, reason: "zoom_error" as const, message };
  }
}

export async function syncZoomMeetingForEvent(eventId: string, options: Options = {}) {
  const record = await loadEventWithMainSession(eventId);
  if (!record) return;
  const { event, session } = record;
  if (!session.zoomMeetingId) {
    if (event.status !== "draft") await ensureZoomMeetingForEvent(eventId, options);
    return;
  }
  try {
    await updateZoomMeeting({
      meetingId: session.zoomMeetingId,
      topic: event.title,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      timezone: event.timezone,
    });
    await writeAuditLog({
      actor: options.actor ?? undefined,
      action: "zoom.meeting.updated",
      resourceType: "session",
      resourceId: session.id,
      summary: `Reunión de Zoom ${session.zoomMeetingId} reprogramada con la nueva fecha de “${event.title}”.`,
      request: options.request,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    await writeAuditLog({
      actor: options.actor ?? undefined,
      action: "zoom.meeting.failed",
      resourceType: "session",
      resourceId: session.id,
      outcome: "failure",
      summary: `No se pudo reprogramar la reunión de Zoom de “${event.title}”: ${message}`,
      request: options.request,
    });
    console.error("[zoom] actualizar reunión", message);
  }
}

export async function cancelZoomMeetingForEvent(eventId: string, options: Options = {}) {
  const record = await loadEventWithMainSession(eventId);
  if (!record?.session.zoomMeetingId) return;
  const { event, session } = record;
  try {
    await deleteZoomMeeting(session.zoomMeetingId!);
    await getDb()
      .update(sessions)
      .set({ zoomMeetingId: null, zoomJoinUrl: null, updatedAt: new Date() })
      .where(eq(sessions.id, session.id));
    await writeAuditLog({
      actor: options.actor ?? undefined,
      action: "zoom.meeting.deleted",
      resourceType: "session",
      resourceId: session.id,
      summary: `Reunión de Zoom ${session.zoomMeetingId} eliminada al cancelar “${event.title}”.`,
      request: options.request,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    await writeAuditLog({
      actor: options.actor ?? undefined,
      action: "zoom.meeting.failed",
      resourceType: "session",
      resourceId: session.id,
      outcome: "failure",
      summary: `No se pudo eliminar la reunión de Zoom de “${event.title}”: ${message}`,
      request: options.request,
    });
    console.error("[zoom] eliminar reunión", message);
  }
}
