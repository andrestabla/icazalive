import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  communicationMessages,
  eventOrganizers,
  eventRegistrationFields,
  events,
  eventTemplates,
  sessions,
} from "@/db/schema";
import type { EventTemplatePayload } from "@/app/api/event-templates/route";
import { writeAuditLog } from "@/lib/audit";
import { DEFAULT_COMMUNICATIONS } from "@/lib/default-communications";
import { requireApiUser } from "@/lib/auth";
import { requireApiPermission } from "@/lib/api-guards";
import {
  attachScheduleConflicts,
  findScheduleConflicts,
} from "@/lib/event-scheduling";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireApiUser())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const db = getDb();
  const records = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      format: events.format,
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      maxAttendees: events.maxAttendees,
      registrationOpen: events.registrationOpen,
      createdBy: events.createdBy,
    })
    .from(events)
    .orderBy(asc(events.startsAt));

  return NextResponse.json({ data: attachScheduleConflicts(records) });
}

export async function POST(request: Request) {
  const permissionCheck = await requireApiPermission("events.manage");
  if ("error" in permissionCheck) return permissionCheck.error;
  const currentUser = await requireApiUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (currentUser.role === "participant") {
    await writeAuditLog({
      actor: currentUser,
      action: "event.create.denied",
      resourceType: "event",
      outcome: "denied",
      summary: "Un participante intentó crear un evento.",
      request,
    });
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const body = (await request.json()) as {
    title?: string;
    format?: "live" | "simulated" | "hybrid";
    startsAt?: string;
    endsAt?: string;
    allowConflict?: boolean;
    templateId?: string;
  };

  const title = body.title?.trim();
  const formats = ["live", "simulated", "hybrid"] as const;
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  let endsAt = body.endsAt ? new Date(body.endsAt) : null;

  // Plantilla: completa formato, duración y configuración base.
  let template: EventTemplatePayload | null = null;
  if (body.templateId) {
    const [record] = await getDb()
      .select({ payload: eventTemplates.payload })
      .from(eventTemplates)
      .where(eq(eventTemplates.id, body.templateId))
      .limit(1);
    if (!record) {
      return NextResponse.json({ error: "La plantilla no existe." }, { status: 404 });
    }
    template = record.payload as EventTemplatePayload;
    body.format = template.format;
    if (startsAt && !body.endsAt) {
      endsAt = new Date(startsAt.getTime() + template.durationMinutes * 60_000);
    }
  }

  if (
    !title ||
    !body.format ||
    !formats.includes(body.format) ||
    !startsAt ||
    !endsAt ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    return NextResponse.json(
      { error: "Los datos del evento no son válidos." },
      { status: 400 },
    );
  }

  const db = getDb();
  const conflicts = await findScheduleConflicts({
    startsAt,
    endsAt,
    format: body.format,
    createdBy: currentUser.id,
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
  const slugBase =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "evento";
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const created = await db.transaction(async (transaction) => {
    const [event] = await transaction
      .insert(events)
      .values({
        title,
        slug,
        format: body.format!,
        status: "draft",
        startsAt,
        endsAt,
        registrationOpen: false,
        createdBy: currentUser.id,
        ...(template
          ? {
              description: template.description,
              timezone: template.timezone,
              maxAttendees: template.maxAttendees,
              selfServiceCutoffMinutes: template.selfServiceCutoffMinutes,
              postRegistrationUrl: template.postRegistrationUrl,
              postEventRedirectUrl: template.postEventRedirectUrl,
              feedbackEnabled: template.feedbackEnabled,
              feedbackQuestion: template.feedbackQuestion,
              brandPrimaryColor: template.brandPrimaryColor,
              brandAccentColor: template.brandAccentColor,
              brandBackgroundColor: template.brandBackgroundColor,
            }
          : {}),
      })
      .returning();

    if (template?.registrationFields.length) {
      await transaction.insert(eventRegistrationFields).values(
        template.registrationFields.map((field) => ({
          eventId: event.id,
          fieldKey: field.fieldKey,
          label: field.label,
          type: field.type,
          required: field.required,
          placeholder: field.placeholder,
          helpText: field.helpText,
          options: field.options,
          position: field.position,
        })) as (typeof eventRegistrationFields.$inferInsert)[],
      );
    }
    if (template?.communications.length) {
      await transaction.insert(communicationMessages).values(
        template.communications.map((message) => ({
          eventId: event.id,
          type: message.type,
          subject: message.subject,
          body: message.body,
          enabled: message.enabled,
          offsetMinutes: message.offsetMinutes,
        })),
      );
    } else {
      // Sin plantilla elegida, el evento nace con la secuencia estándar de la
      // plataforma para que registro y recordatorios funcionen desde el inicio.
      await transaction.insert(communicationMessages).values(
        DEFAULT_COMMUNICATIONS.map((message) => ({
          eventId: event.id,
          type: message.type,
          subject: message.subject,
          body: message.body,
          enabled: message.enabled,
          offsetMinutes: message.offsetMinutes,
        })),
      );
    }

    await transaction.insert(sessions).values({
      eventId: event.id,
      title: "Sesión principal",
      startsAt,
      endsAt,
    });

    await transaction.insert(eventOrganizers).values({
      eventId: event.id,
      userId: currentUser.id,
      role: "owner",
    });

    return event;
  });

  await writeAuditLog({
    actor: currentUser,
    action: "event.created",
    resourceType: "event",
    resourceId: created.id,
    summary: `Evento “${created.title}” creado.`,
    details: {
      slug: created.slug,
      format: created.format,
      startsAt: created.startsAt.toISOString(),
      endsAt: created.endsAt.toISOString(),
      conflictOverride: conflicts.length > 0,
    },
    request,
  });
  return NextResponse.json(
    { data: { ...created, conflicts } },
    { status: 201 },
  );
}
