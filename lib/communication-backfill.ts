import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  communicationDeliveries,
  communicationMessages,
  events,
  registrationAccessTokens,
  registrations,
  users,
} from "@/db/schema";
import { renderParticipantCommunication } from "@/lib/communication-renderer";
import { DEFAULT_COMMUNICATIONS } from "@/lib/default-communications";
import {
  createRegistrationAccessToken,
  hashRegistrationAccessToken,
} from "@/lib/registration-access";

// Mensajes que se envían después de que termine el evento y se programan en
// relación con su hora de fin.
export const AFTER_EVENT_TYPES = ["post_event", "no_show_followup"] as const;
export type AfterEventType = (typeof AFTER_EVENT_TYPES)[number];

export function isAfterEventType(type: string): type is AfterEventType {
  return (AFTER_EVENT_TYPES as readonly string[]).includes(type);
}

// Garantiza que el evento tenga la plantilla de un tipo (para eventos creados
// antes de que existiera). Se crea desactivada si así lo indica la plantilla.
export async function ensureMessageOfType(eventId: string, type: "no_show_followup" | "post_event") {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(communicationMessages)
    .where(and(eq(communicationMessages.eventId, eventId), eq(communicationMessages.type, type)))
    .limit(1);
  if (existing) return existing;
  const template = DEFAULT_COMMUNICATIONS.find((message) => message.type === type)!;
  const [created] = await db
    .insert(communicationMessages)
    .values({
      eventId,
      type,
      subject: template.subject,
      body: template.body,
      enabled: template.enabled,
      offsetMinutes: template.offsetMinutes,
    })
    .returning();
  return created;
}

/**
 * Programa la entrega de un mensaje posterior al evento para las inscripciones
 * que todavía no la tienen (por ejemplo, al activar "Recordatorio oportunidad"
 * en un evento con inscritos). El enlace personal se recupera del último
 * correo generado; si no coincide con el vigente, se emite uno nuevo.
 */
export async function backfillAfterEventDeliveries(
  eventId: string,
  messageId: string,
  origin: string,
): Promise<number> {
  const db = getDb();
  const [message] = await db
    .select()
    .from(communicationMessages)
    .where(and(eq(communicationMessages.id, messageId), eq(communicationMessages.eventId, eventId)))
    .limit(1);
  if (!message || !isAfterEventType(message.type)) return 0;
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event || event.status === "cancelled") return 0;

  const rows = await db
    .select({
      registrationId: registrations.id,
      status: registrations.status,
      name: users.name,
      email: users.email,
      active: users.active,
      tokenHash: registrationAccessTokens.tokenHash,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.participantId, users.id))
    .leftJoin(registrationAccessTokens, eq(registrationAccessTokens.registrationId, registrations.id))
    .where(and(eq(registrations.eventId, eventId), ne(registrations.status, "cancelled")));
  if (rows.length === 0) return 0;

  const registrationIds = rows.map((row) => row.registrationId);
  const existing = await db
    .select({ registrationId: communicationDeliveries.registrationId, type: communicationDeliveries.type, body: communicationDeliveries.body, createdAt: communicationDeliveries.createdAt })
    .from(communicationDeliveries)
    .where(inArray(communicationDeliveries.registrationId, registrationIds))
    .orderBy(desc(communicationDeliveries.createdAt));
  const alreadyHas = new Set(existing.filter((row) => row.type === message.type).map((row) => row.registrationId));
  const knownTokens = new Map<string, string>();
  for (const row of existing) {
    if (knownTokens.has(row.registrationId)) continue;
    const match = row.body.match(/[?&]access=([A-Za-z0-9_-]{32,})/);
    if (match) knownTokens.set(row.registrationId, match[1]);
  }

  const scheduledFor = new Date(event.endsAt.getTime() + message.offsetMinutes * 60_000);
  let created = 0;
  for (const row of rows) {
    if (alreadyHas.has(row.registrationId) || !row.active) continue;
    let token = knownTokens.get(row.registrationId) ?? null;
    if (!token || !row.tokenHash || hashRegistrationAccessToken(token) !== row.tokenHash) {
      const fresh = createRegistrationAccessToken();
      const expiresAt = new Date(Math.max(event.endsAt.getTime() + 30 * 24 * 60 * 60_000, Date.now() + 7 * 24 * 60 * 60_000));
      await db
        .insert(registrationAccessTokens)
        .values({ registrationId: row.registrationId, tokenHash: fresh.tokenHash, expiresAt })
        .onConflictDoUpdate({ target: registrationAccessTokens.registrationId, set: { tokenHash: fresh.tokenHash, expiresAt, updatedAt: new Date() } });
      token = fresh.token;
    }
    const renderingInput = {
      participantName: row.name,
      eventTitle: event.title,
      eventSlug: event.slug,
      startsAt: event.startsAt,
      timezone: event.timezone,
      origin,
      accessToken: token,
    };
    const subject = renderParticipantCommunication({ template: message.subject, ...renderingInput }).body;
    const body = renderParticipantCommunication({ template: message.body, ...renderingInput }).body;
    await db
      .insert(communicationDeliveries)
      .values({
        eventId,
        registrationId: row.registrationId,
        messageId: message.id,
        type: message.type,
        status: "scheduled",
        recipientEmail: row.email,
        subject,
        body,
        scheduledFor,
      })
      .onConflictDoNothing();
    created += 1;
  }
  return created;
}
