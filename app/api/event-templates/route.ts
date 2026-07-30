import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  communicationMessages,
  eventRegistrationFields,
  events,
  eventTemplates,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser, type AuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";

export type EventTemplatePayload = {
  format: "live" | "simulated" | "hybrid";
  durationMinutes: number;
  timezone: string;
  description: string | null;
  maxAttendees: number;
  selfServiceCutoffMinutes: number;
  postRegistrationUrl: string | null;
  postEventRedirectUrl: string | null;
  feedbackEnabled: boolean;
  feedbackQuestion: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  brandBackgroundColor: string | null;
  registrationFields: {
    fieldKey: string;
    label: string;
    type: "text" | "textarea" | "select" | "checkbox";
    required: boolean;
    placeholder: string | null;
    helpText: string | null;
    options: unknown;
    position: number;
  }[];
  communications: {
    type: "registration_confirmation" | "reminder_24h" | "reminder_1h" | "post_event";
    subject: string;
    body: string;
    enabled: boolean;
    offsetMinutes: number;
  }[];
};

async function requireStaff(): Promise<
  { user: AuthenticatedUser } | { error: NextResponse }
> {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (user.role === "participant") {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const templates = await getDb()
    .select({
      id: eventTemplates.id,
      name: eventTemplates.name,
      description: eventTemplates.description,
      payload: eventTemplates.payload,
      createdAt: eventTemplates.createdAt,
      createdByName: users.name,
    })
    .from(eventTemplates)
    .innerJoin(users, eq(eventTemplates.createdBy, users.id))
    .orderBy(asc(eventTemplates.name));

  return NextResponse.json({
    data: templates.map((template) => {
      const payload = template.payload as EventTemplatePayload;
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        format: payload.format,
        durationMinutes: payload.durationMinutes,
        createdAt: template.createdAt,
        createdByName: template.createdByName,
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    eventSlug?: string;
    name?: string;
    description?: string;
  };
  const name = body.name?.trim();
  if (!body.eventSlug || !name || name.length < 2 || name.length > 120) {
    return NextResponse.json(
      { error: "Indica el evento base y un nombre de 2 a 120 caracteres." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, body.eventSlug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const [fields, communications] = await Promise.all([
    db
      .select()
      .from(eventRegistrationFields)
      .where(eq(eventRegistrationFields.eventId, event.id))
      .orderBy(asc(eventRegistrationFields.position)),
    db
      .select()
      .from(communicationMessages)
      .where(eq(communicationMessages.eventId, event.id)),
  ]);

  const payload: EventTemplatePayload = {
    format: event.format,
    durationMinutes: Math.max(
      15,
      Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60_000),
    ),
    timezone: event.timezone,
    description: event.description,
    maxAttendees: event.maxAttendees,
    selfServiceCutoffMinutes: event.selfServiceCutoffMinutes,
    postRegistrationUrl: event.postRegistrationUrl,
    postEventRedirectUrl: event.postEventRedirectUrl,
    feedbackEnabled: event.feedbackEnabled,
    feedbackQuestion: event.feedbackQuestion,
    brandPrimaryColor: event.brandPrimaryColor,
    brandAccentColor: event.brandAccentColor,
    brandBackgroundColor: event.brandBackgroundColor,
    registrationFields: fields.map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder,
      helpText: field.helpText,
      options: field.options,
      position: field.position,
    })),
    communications: communications.map((message) => ({
      type: message.type,
      subject: message.subject,
      body: message.body,
      enabled: message.enabled,
      offsetMinutes: message.offsetMinutes,
    })),
  };

  const [created] = await db
    .insert(eventTemplates)
    .values({
      name,
      description: body.description?.trim().slice(0, 300) || null,
      payload,
      createdBy: auth.user.id,
    })
    .returning({ id: eventTemplates.id, name: eventTemplates.name });

  await writeAuditLog({
    actor: auth.user,
    action: "event.template.created",
    resourceType: "event_template",
    resourceId: created.id,
    summary: `Plantilla “${created.name}” creada desde “${event.title}”.`,
    details: { sourceEventId: event.id },
    request,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Plantilla no válida." }, { status: 400 });
  }
  const db = getDb();
  const [removed] = await db
    .delete(eventTemplates)
    .where(eq(eventTemplates.id, body.id))
    .returning({ id: eventTemplates.id, name: eventTemplates.name });
  if (!removed) {
    return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
  }
  await writeAuditLog({
    actor: auth.user,
    action: "event.template.deleted",
    resourceType: "event_template",
    resourceId: removed.id,
    summary: `Plantilla “${removed.name}” eliminada.`,
    request,
  });
  return NextResponse.json({ data: { deleted: true } });
}
