import { and, asc, count, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  eventRegistrationFields,
  events,
  registrationFieldResponses,
  registrations,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  getBearerToken,
  resolveRegistrationAccess,
} from "@/lib/registration-access";
import { validateRegistrationResponses } from "@/lib/registration-fields";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

function requestToken(request: Request) {
  return (
    getBearerToken(request) ||
    new URL(request.url).searchParams.get("access") ||
    ""
  );
}

async function getRegistrationContext(request: Request, slug: string) {
  const access = await resolveRegistrationAccess(requestToken(request), slug, {
    includeCancelled: true,
  });
  if (!access) return null;

  const db = getDb();
  const [[record], fields, responses] = await Promise.all([
    db
      .select({
        registrationId: registrations.id,
        status: registrations.status,
        company: registrations.company,
        jobTitle: registrations.jobTitle,
        phone: registrations.phone,
        marketingConsent: registrations.marketingConsent,
        registeredAt: registrations.registeredAt,
        participantId: users.id,
        name: users.name,
        email: users.email,
        eventId: events.id,
        eventTitle: events.title,
        eventSlug: events.slug,
        eventStatus: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        timezone: events.timezone,
        registrationOpen: events.registrationOpen,
        maxAttendees: events.maxAttendees,
        selfServiceCutoffMinutes: events.selfServiceCutoffMinutes,
      })
      .from(registrations)
      .innerJoin(users, eq(registrations.participantId, users.id))
      .innerJoin(events, eq(registrations.eventId, events.id))
      .where(eq(registrations.id, access.registrationId))
      .limit(1),
    db
      .select()
      .from(eventRegistrationFields)
      .where(
        and(
          eq(eventRegistrationFields.eventId, access.eventId),
          eq(eventRegistrationFields.active, true),
        ),
      )
      .orderBy(
        asc(eventRegistrationFields.position),
        asc(eventRegistrationFields.createdAt),
      ),
    db
      .select({
        fieldId: registrationFieldResponses.fieldId,
        value: registrationFieldResponses.value,
      })
      .from(registrationFieldResponses)
      .where(
        eq(registrationFieldResponses.registrationId, access.registrationId),
      ),
  ]);
  return record ? { access, record, fields, responses } : null;
}

function selfServiceDeadline(record: {
  startsAt: Date;
  selfServiceCutoffMinutes: number;
}) {
  return new Date(
    record.startsAt.getTime() - record.selfServiceCutoffMinutes * 60_000,
  );
}

function selfServiceClosed(record: {
  startsAt: Date;
  selfServiceCutoffMinutes: number;
}) {
  return Date.now() > selfServiceDeadline(record).getTime();
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const registration = await getRegistrationContext(request, slug);
  if (!registration) {
    return NextResponse.json(
      { error: "El enlace de gestión no es válido o ya expiró." },
      { status: 401 },
    );
  }
  const responseValues = Object.fromEntries(
    registration.responses.map((response) => [
      response.fieldId,
      response.value ?? "",
    ]),
  );
  return NextResponse.json({
    data: {
      registration: {
        id: registration.record.registrationId,
        status: registration.record.status,
        name: registration.record.name,
        email: registration.record.email,
        company: registration.record.company,
        jobTitle: registration.record.jobTitle,
        phone: registration.record.phone,
        marketingConsent: registration.record.marketingConsent,
        registeredAt: registration.record.registeredAt,
      },
      event: {
        title: registration.record.eventTitle,
        slug: registration.record.eventSlug,
        status: registration.record.eventStatus,
        startsAt: registration.record.startsAt,
        endsAt: registration.record.endsAt,
        timezone: registration.record.timezone,
        registrationOpen: registration.record.registrationOpen,
        selfServiceClosesAt: selfServiceDeadline(registration.record),
        selfServiceClosed: selfServiceClosed(registration.record),
      },
      fields: registration.fields,
      responses: responseValues,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const registration = await getRegistrationContext(request, slug);
  if (!registration) {
    return NextResponse.json(
      { error: "El enlace de gestión no es válido o ya expiró." },
      { status: 401 },
    );
  }
  const body = (await request.json()) as {
    action?: "cancel" | "reactivate";
    name?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    marketingConsent?: boolean;
    customResponses?: unknown;
  };
  const db = getDb();

  if (selfServiceClosed(registration.record)) {
    return NextResponse.json(
      {
        error:
          "El plazo para editar o cancelar esta inscripción ya cerró. Contacta al equipo del evento si necesitas un cambio.",
      },
      { status: 409 },
    );
  }

  if (body.action === "cancel") {
    await db
      .update(registrations)
      .set({ status: "cancelled" })
      .where(eq(registrations.id, registration.record.registrationId));
    await writeAuditLog({
      actorEmail: registration.record.email,
      action: "registration.self_service.cancelled",
      resourceType: "registration",
      resourceId: registration.record.registrationId,
      summary: `Inscripción a “${registration.record.eventTitle}” cancelada por el asistente.`,
      details: { eventId: registration.record.eventId },
      request,
    });
    return NextResponse.json({ data: { status: "cancelled" } });
  }

  if (body.action === "reactivate") {
    if (
      !registration.record.registrationOpen ||
      registration.record.eventStatus === "completed" ||
      registration.record.eventStatus === "cancelled"
    ) {
      return NextResponse.json(
        { error: "El registro del evento ya no está disponible." },
        { status: 409 },
      );
    }
    const [summary] = await db
      .select({ total: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, registration.record.eventId),
          ne(registrations.status, "cancelled"),
        ),
      );
    if ((summary?.total ?? 0) >= registration.record.maxAttendees) {
      return NextResponse.json(
        { error: "El evento alcanzó su capacidad máxima." },
        { status: 409 },
      );
    }
    await db
      .update(registrations)
      .set({ status: "registered" })
      .where(eq(registrations.id, registration.record.registrationId));
    await writeAuditLog({
      actorEmail: registration.record.email,
      action: "registration.self_service.reactivated",
      resourceType: "registration",
      resourceId: registration.record.registrationId,
      summary: `Inscripción a “${registration.record.eventTitle}” reactivada por el asistente.`,
      details: { eventId: registration.record.eventId },
      request,
    });
    return NextResponse.json({ data: { status: "registered" } });
  }

  if (registration.record.status === "cancelled") {
    return NextResponse.json(
      { error: "Reactiva la inscripción antes de editar los datos." },
      { status: 409 },
    );
  }
  const name = body.name?.trim();
  if (!name || name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { error: "Ingresa un nombre válido." },
      { status: 400 },
    );
  }
  const validatedResponses = validateRegistrationResponses(
    registration.fields,
    body.customResponses,
  );
  if (validatedResponses.error) {
    return NextResponse.json(
      { error: validatedResponses.error },
      { status: 400 },
    );
  }

  await db.transaction(async (transaction) => {
    await transaction
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, registration.record.participantId));
    await transaction
      .update(registrations)
      .set({
        company: body.company?.trim().slice(0, 150) || null,
        jobTitle: body.jobTitle?.trim().slice(0, 150) || null,
        phone: body.phone?.trim().slice(0, 40) || null,
        marketingConsent: body.marketingConsent === true,
      })
      .where(eq(registrations.id, registration.record.registrationId));
    await transaction
      .delete(registrationFieldResponses)
      .where(
        eq(
          registrationFieldResponses.registrationId,
          registration.record.registrationId,
        ),
      );
    if (validatedResponses.values.length) {
      await transaction.insert(registrationFieldResponses).values(
        validatedResponses.values.map((response) => ({
          registrationId: registration.record.registrationId,
          fieldId: response.fieldId,
          value: response.value,
        })),
      );
    }
  });

  await writeAuditLog({
    actorEmail: registration.record.email,
    action: "registration.self_service.updated",
    resourceType: "registration",
    resourceId: registration.record.registrationId,
    summary: `Datos de inscripción a “${registration.record.eventTitle}” actualizados por el asistente.`,
    details: {
      eventId: registration.record.eventId,
      customFields: validatedResponses.values.length,
      marketingConsent: body.marketingConsent === true,
    },
    request,
  });
  return NextResponse.json({ data: { status: registration.record.status } });
}
