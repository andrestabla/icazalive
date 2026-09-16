import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
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
import { requireApiUser } from "@/lib/auth";
import { requireApiPermission } from "@/lib/api-guards";
import { canManageEvent } from "@/lib/event-permissions";
import { getBrandSettings } from "@/lib/brand";
import { renderParticipantCommunication } from "@/lib/communication-renderer";
import { DEFAULT_COMMUNICATIONS } from "@/lib/default-communications";
import { renderBrandedEmail } from "@/lib/email-branding";
import { activeProviderName, sendEmail } from "@/lib/email-provider";
import { getPublicOrigin } from "@/lib/public-origin";
import {
  createRegistrationAccessToken,
  hashRegistrationAccessToken,
} from "@/lib/registration-access";
import { applySchedulingLink, resolveEventSchedulingUrl, SCHEDULE_LINK_TAG } from "@/lib/scheduling-link";

export const runtime = "nodejs";

const TEMPLATE_TYPES = ["registration_confirmation", "reminder_24h", "reminder_1h", "live_now", "post_event"] as const;
type TemplateType = (typeof TEMPLATE_TYPES)[number];
const MAX_RECIPIENTS = 500;

// Envío manual a participantes seleccionados desde la sección Participantes.
// Se puede usar una de las plantillas del evento (cada persona recibe la
// versión de su propio evento) o un mensaje nuevo con las mismas variables.
// Todos los correos salen con la cabecera y el pie de la marca. El enlace
// personal se conserva: se recupera del último correo enviado y solo se emite
// uno nuevo si la persona todavía no tenía.
export async function POST(request: Request) {
  const permissionCheck = await requireApiPermission("participants.manage");
  if ("error" in permissionCheck) return permissionCheck.error;
  const currentUser = await requireApiUser();
  if (!currentUser) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (currentUser.role === "participant") return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    registrationIds?: unknown;
    templateType?: string;
    subject?: string;
    body?: string;
  };
  const registrationIds = Array.isArray(body.registrationIds)
    ? Array.from(new Set(body.registrationIds.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];
  if (registrationIds.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos un participante." }, { status: 400 });
  }
  if (registrationIds.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `Máximo ${MAX_RECIPIENTS} destinatarios por envío.` }, { status: 400 });
  }
  const templateType = body.templateType && TEMPLATE_TYPES.includes(body.templateType as TemplateType)
    ? (body.templateType as TemplateType)
    : null;
  const customSubject = body.subject?.trim() ?? "";
  const customBody = body.body?.trim() ?? "";
  if (!templateType && (!customSubject || !customBody)) {
    return NextResponse.json({ error: "Elige una plantilla o escribe asunto y mensaje." }, { status: 400 });
  }
  if (customSubject.length > 180 || customBody.length > 10_000) {
    return NextResponse.json({ error: "Revisa el asunto (máximo 180 caracteres) y el mensaje." }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({
      registrationId: registrations.id,
      status: registrations.status,
      participantName: users.name,
      participantEmail: users.email,
      participantActive: users.active,
      eventId: events.id,
      eventTitle: events.title,
      eventSlug: events.slug,
      startsAt: events.startsAt,
      timezone: events.timezone,
      tokenHash: registrationAccessTokens.tokenHash,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.participantId, users.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .leftJoin(registrationAccessTokens, eq(registrationAccessTokens.registrationId, registrations.id))
    .where(inArray(registrations.id, registrationIds));

  // Solo destinatarios de eventos que el usuario gestiona (administrador: todos).
  const manageable = new Map<string, boolean>();
  for (const eventId of new Set(rows.map((row) => row.eventId))) {
    manageable.set(eventId, await canManageEvent(currentUser, eventId));
  }
  const recipients = rows.filter(
    (row) => row.status !== "cancelled" && row.participantActive && manageable.get(row.eventId),
  );
  if (recipients.length === 0) {
    return NextResponse.json({ error: "Ninguno de los seleccionados puede recibir correos (cancelados o inactivos)." }, { status: 400 });
  }

  // Plantillas por evento (solo si se eligió una plantilla).
  const eventIds = Array.from(new Set(recipients.map((row) => row.eventId)));
  const templatesByEvent = new Map<string, { subject: string; body: string }>();
  if (templateType) {
    const templates = await db
      .select({ eventId: communicationMessages.eventId, subject: communicationMessages.subject, body: communicationMessages.body })
      .from(communicationMessages)
      .where(and(inArray(communicationMessages.eventId, eventIds), eq(communicationMessages.type, templateType)));
    for (const template of templates) templatesByEvent.set(template.eventId, template);
  }
  const fallbackTemplate = templateType ? DEFAULT_COMMUNICATIONS.find((message) => message.type === templateType) ?? null : null;

  // Enlaces personales: se recuperan del último correo generado para cada
  // inscripción; si no coincide con el hash vigente, se emite uno nuevo.
  const deliveries = await db
    .select({ registrationId: communicationDeliveries.registrationId, body: communicationDeliveries.body, createdAt: communicationDeliveries.createdAt })
    .from(communicationDeliveries)
    .where(inArray(communicationDeliveries.registrationId, recipients.map((row) => row.registrationId)))
    .orderBy(desc(communicationDeliveries.createdAt));
  const knownTokens = new Map<string, string>();
  for (const delivery of deliveries) {
    if (knownTokens.has(delivery.registrationId)) continue;
    const match = delivery.body.match(/[?&]access=([A-Za-z0-9_-]{32,})/);
    if (match) knownTokens.set(delivery.registrationId, match[1]);
  }

  const schedulingByEvent = new Map<string, string | null>();
  const brand = await getBrandSettings().catch(() => null);
  const origin = getPublicOrigin(request);
  const provider = activeProviderName();
  const summary = { sent: 0, failed: 0, skipped: rows.length - recipients.length, errors: [] as string[] };

  for (const recipient of recipients) {
    let accessToken = knownTokens.get(recipient.registrationId) ?? null;
    if (!accessToken || !recipient.tokenHash || hashRegistrationAccessToken(accessToken) !== recipient.tokenHash) {
      const fresh = createRegistrationAccessToken();
      const expiresAt = new Date(Math.max(recipient.startsAt.getTime() + 30 * 24 * 60 * 60_000, Date.now() + 7 * 24 * 60 * 60_000));
      await db
        .insert(registrationAccessTokens)
        .values({ registrationId: recipient.registrationId, tokenHash: fresh.tokenHash, expiresAt })
        .onConflictDoUpdate({
          target: registrationAccessTokens.registrationId,
          set: { tokenHash: fresh.tokenHash, expiresAt, updatedAt: new Date() },
        });
      accessToken = fresh.token;
    }

    const template = templateType
      ? templatesByEvent.get(recipient.eventId) ?? fallbackTemplate
      : { subject: customSubject, body: customBody };
    if (!template) {
      summary.failed += 1;
      summary.errors.push(`${recipient.participantEmail}: el evento no tiene esa plantilla.`);
      continue;
    }
    const renderingInput = {
      participantName: recipient.participantName,
      eventTitle: recipient.eventTitle,
      eventSlug: recipient.eventSlug,
      startsAt: recipient.startsAt,
      timezone: recipient.timezone,
      origin,
      accessToken,
    };
    const subject = renderParticipantCommunication({ template: template.subject, ...renderingInput }).body;
    let rendered = renderParticipantCommunication({
      template: template.body,
      includeManagementFooter: templateType === "registration_confirmation",
      ...renderingInput,
    }).body;
    if (rendered.includes(SCHEDULE_LINK_TAG)) {
      if (!schedulingByEvent.has(recipient.eventId)) {
        const scheduling = await resolveEventSchedulingUrl(recipient.eventId).catch(() => ({ url: null }));
        schedulingByEvent.set(recipient.eventId, scheduling.url);
      }
      rendered = applySchedulingLink(rendered, schedulingByEvent.get(recipient.eventId) ?? null);
    }

    const result = await sendEmail({
      to: recipient.participantEmail,
      subject: applySchedulingLink(subject, null),
      body: rendered,
      html: renderBrandedEmail({ bodyText: rendered, brand }),
    });
    if (result.ok) {
      summary.sent += 1;
    } else {
      summary.failed += 1;
      if (summary.errors.length < 5) summary.errors.push(`${recipient.participantEmail}: ${result.error}`);
    }
  }

  await writeAuditLog({
    actor: currentUser,
    action: "communications.manual.sent",
    resourceType: "communications",
    resourceId: null,
    summary: `Envío manual (${templateType ?? "mensaje nuevo"}): ${summary.sent} enviados, ${summary.failed} fallidos, ${summary.skipped} omitidos (proveedor ${provider}).`,
    details: { templateType, subject: templateType ? null : customSubject, recipients: recipients.length, sent: summary.sent, failed: summary.failed, skipped: summary.skipped, errors: summary.errors.join(" | ") || null },
    request,
  });

  return NextResponse.json({ data: { ...summary, provider } });
}
