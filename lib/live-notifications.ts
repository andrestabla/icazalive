import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  communicationDeliveries,
  communicationMessages,
  events,
  registrationAccessTokens,
  registrations,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { renderParticipantCommunication } from "@/lib/communication-renderer";
import { triggerDeliveries } from "@/lib/communication-worker";
import { DEFAULT_COMMUNICATIONS } from "@/lib/default-communications";
import { createRegistrationAccessToken } from "@/lib/registration-access";

// Aviso "Ya estamos en vivo": se envía a los inscritos en el momento en que
// el evento pasa a EN VIVO (a mano o por la automatización del simulado).
// La entrega se prepara al inscribirse (con el enlace personal ya rendido) y
// queda en espera; al iniciar el evento se libera y el worker la envía.

export async function ensureLiveNowMessage(eventId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(communicationMessages)
    .where(and(eq(communicationMessages.eventId, eventId), eq(communicationMessages.type, "live_now")))
    .limit(1);
  if (existing) return existing;
  const template = DEFAULT_COMMUNICATIONS.find((message) => message.type === "live_now")!;
  const [created] = await db
    .insert(communicationMessages)
    .values({
      eventId,
      type: "live_now",
      subject: template.subject,
      body: template.body,
      enabled: template.enabled,
      offsetMinutes: template.offsetMinutes,
    })
    .returning();
  return created;
}

export function publicOrigin(): string {
  return (process.env.APP_BASE_URL?.trim().replace(/\/+$/, "")) || "https://liveicazajammoul.com";
}

export async function notifyEventLive(eventId: string, origin: string = publicOrigin()): Promise<number> {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event || event.status !== "live") return 0;
  const message = await ensureLiveNowMessage(eventId);
  if (!message.enabled) return 0;

  const rows = await db
    .select({ registration: registrations, participant: users })
    .from(registrations)
    .innerJoin(users, eq(registrations.participantId, users.id))
    .where(
      and(
        eq(registrations.eventId, eventId),
        inArray(registrations.status, ["registered", "confirmed", "attended"]),
      ),
    );
  const now = new Date();
  let released = 0;

  for (const { registration, participant } of rows) {
    const [existing] = await db
      .select()
      .from(communicationDeliveries)
      .where(
        and(
          eq(communicationDeliveries.registrationId, registration.id),
          eq(communicationDeliveries.type, "live_now"),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === "scheduled" || existing.status === "queued") {
        await db
          .update(communicationDeliveries)
          .set({ status: "queued", scheduledFor: now, updatedAt: now })
          .where(eq(communicationDeliveries.id, existing.id));
        released += 1;
      }
      continue;
    }

    // Inscripción anterior a esta función: no hay entrega preparada ni token
    // en claro, así que se emite un enlace personal nuevo (el anterior deja
    // de servir) y se crea la entrega con la plantilla vigente del evento.
    const access = createRegistrationAccessToken();
    const expiresAt = new Date(Math.max(event.endsAt.getTime() + 7 * 24 * 60 * 60 * 1000, Date.now() + 24 * 60 * 60 * 1000));
    await db
      .insert(registrationAccessTokens)
      .values({ registrationId: registration.id, tokenHash: access.tokenHash, expiresAt })
      .onConflictDoUpdate({
        target: registrationAccessTokens.registrationId,
        set: { tokenHash: access.tokenHash, expiresAt, updatedAt: now },
      });
    const input = {
      participantName: participant.name,
      eventTitle: event.title,
      eventSlug: event.slug,
      startsAt: event.startsAt,
      timezone: event.timezone,
      origin,
      accessToken: access.token,
    };
    await db.insert(communicationDeliveries).values({
      eventId,
      registrationId: registration.id,
      messageId: message.id,
      type: "live_now",
      status: "queued",
      recipientEmail: participant.email,
      subject: renderParticipantCommunication({ template: message.subject, ...input }).body,
      body: renderParticipantCommunication({ template: message.body, ...input }).body,
      scheduledFor: now,
    });
    released += 1;
  }

  await writeAuditLog({
    action: "communications.live_now.released",
    resourceType: "event",
    resourceId: eventId,
    summary: `Aviso “Ya estamos en vivo” preparado para ${released} inscrito${released === 1 ? "" : "s"} de “${event.title}”.`,
    details: { released, recipients: rows.length },
  });
  if (released > 0) triggerDeliveries(eventId);
  return released;
}
