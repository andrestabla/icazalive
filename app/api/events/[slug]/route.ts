import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  events,
  integrationConnections,
  registrations,
  sessions,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { canManageEvent } from "@/lib/event-permissions";
import {
  canTransition,
  eventStatusLabels,
  eventStatusTransitions,
  type EventStatus,
} from "@/lib/event-status";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_: Request, context: RouteContext) {
  if (!(await requireApiUser())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { slug } = await context.params;
  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const [eventSessions, registrationSummary, integrations] = await Promise.all([
    db
      .select()
      .from(sessions)
      .where(eq(sessions.eventId, event.id))
      .orderBy(sessions.startsAt),
    db
      .select({ total: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, event.id),
          eq(registrations.status, "registered"),
        ),
      ),
    db
      .select({
        provider: integrationConnections.provider,
        status: integrationConnections.status,
        accountLabel: integrationConnections.accountLabel,
      })
      .from(integrationConnections),
  ]);

  return NextResponse.json({
    data: {
      event,
      sessions: eventSessions,
      registrations: registrationSummary[0]?.total ?? 0,
      integrations,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const currentUser = await requireApiUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (currentUser.role === "participant") {
    await writeAuditLog({
      actor: currentUser,
      action: "event.update.denied",
      resourceType: "event",
      outcome: "denied",
      summary: "Un participante intentó actualizar un evento.",
      request,
    });
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const { slug } = await context.params;
  const body = (await request.json()) as {
    status?: string;
    registrationOpen?: boolean;
    selfServiceCutoffMinutes?: number;
    postRegistrationUrl?: string | null;
    postEventRedirectUrl?: string | null;
    feedbackEnabled?: boolean;
    feedbackQuestion?: string | null;
    brandPrimaryColor?: string | null;
    brandAccentColor?: string | null;
    brandBackgroundColor?: string | null;
  };
  const allowedStatuses = [
    "draft",
    "registration_open",
    "preparing",
    "live",
    "completed",
    "cancelled",
  ] as const;

  if (
    body.status !== undefined &&
    !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])
  ) {
    return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
  }

  for (const urlField of ["postRegistrationUrl", "postEventRedirectUrl"] as const) {
    const value = body[urlField];
    if (value === undefined || value === null) continue;
    if (
      typeof value !== "string" ||
      value.length > 500 ||
      !/^https?:\/\/[^\s]+$/.test(value)
    ) {
      return NextResponse.json(
        {
          error:
            "La URL de redirección debe iniciar con http:// o https:// y no superar 500 caracteres.",
        },
        { status: 400 },
      );
    }
  }


  if (body.registrationOpen !== undefined && typeof body.registrationOpen !== "boolean") {
    return NextResponse.json(
      { error: "El estado del registro no es válido." },
      { status: 400 },
    );
  }

  if (
    body.selfServiceCutoffMinutes !== undefined &&
    (typeof body.selfServiceCutoffMinutes !== "number" ||
      !Number.isInteger(body.selfServiceCutoffMinutes) ||
      body.selfServiceCutoffMinutes < 0 ||
      body.selfServiceCutoffMinutes > 20_160)
  ) {
    return NextResponse.json(
      {
        error:
          "El plazo de autogestión debe ser un número entero de minutos entre 0 y 20160 (14 días).",
      },
      { status: 400 },
    );
  }

  if (
    body.feedbackEnabled !== undefined &&
    typeof body.feedbackEnabled !== "boolean"
  ) {
    return NextResponse.json(
      { error: "La configuración de feedback no es válida." },
      { status: 400 },
    );
  }
  if (
    body.feedbackQuestion !== undefined &&
    body.feedbackQuestion !== null &&
    (typeof body.feedbackQuestion !== "string" ||
      body.feedbackQuestion.trim().length > 300)
  ) {
    return NextResponse.json(
      { error: "La pregunta de feedback no puede superar 300 caracteres." },
      { status: 400 },
    );
  }

  const brandColorFields = [
    "brandPrimaryColor",
    "brandAccentColor",
    "brandBackgroundColor",
  ] as const;
  for (const field of brandColorFields) {
    const value = body[field];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))
    ) {
      return NextResponse.json(
        { error: "Los colores del evento deben ser valores hexadecimales (#RRGGBB)." },
        { status: 400 },
      );
    }
  }

  const db = getDb();
  const [current] = await db
    .select({ id: events.id, status: events.status })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!current) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  if (!(await canManageEvent(currentUser, current.id))) {
    await writeAuditLog({
      actor: currentUser,
      action: "event.update.denied",
      resourceType: "event",
      resourceId: current.id,
      outcome: "denied",
      summary: "Intento de actualizar un evento sin ser organizador asignado.",
      request,
    });
    return NextResponse.json(
      { error: "No eres organizador de este evento." },
      { status: 403 },
    );
  }

  const currentStatus = current.status as EventStatus;
  const changes: {
    status?: (typeof allowedStatuses)[number];
    registrationOpen?: boolean;
    selfServiceCutoffMinutes?: number;
    postRegistrationUrl?: string | null;
    postEventRedirectUrl?: string | null;
    feedbackEnabled?: boolean;
    feedbackQuestion?: string | null;
    brandPrimaryColor?: string | null;
    brandAccentColor?: string | null;
    brandBackgroundColor?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (body.selfServiceCutoffMinutes !== undefined) {
    changes.selfServiceCutoffMinutes = body.selfServiceCutoffMinutes;
  }
  if (body.postRegistrationUrl !== undefined) {
    changes.postRegistrationUrl = body.postRegistrationUrl || null;
  }
  if (body.postEventRedirectUrl !== undefined) {
    changes.postEventRedirectUrl = body.postEventRedirectUrl || null;
  }
  if (body.feedbackEnabled !== undefined) {
    changes.feedbackEnabled = body.feedbackEnabled;
  }
  if (body.feedbackQuestion !== undefined) {
    changes.feedbackQuestion = body.feedbackQuestion?.trim() || null;
  }
  for (const field of brandColorFields) {
    if (body[field] !== undefined) {
      changes[field] = body[field] ?? null;
    }
  }

  if (body.status) {
    const target = body.status as EventStatus;
    if (!canTransition(currentStatus, target)) {
      const allowed = eventStatusTransitions[currentStatus]
        .map((status) => eventStatusLabels[status])
        .join(", ");
      return NextResponse.json(
        {
          error: `No es posible pasar de “${eventStatusLabels[currentStatus]}” a “${eventStatusLabels[target]}”. ${
            allowed ? `Transiciones permitidas: ${allowed}.` : "Este estado es definitivo."
          }`,
        },
        { status: 409 },
      );
    }
    changes.status = target;
  }
  if (body.registrationOpen !== undefined) {
    if (
      body.registrationOpen &&
      (currentStatus === "completed" || currentStatus === "cancelled")
    ) {
      return NextResponse.json(
        { error: "No es posible abrir el registro de un evento completado o cancelado." },
        { status: 409 },
      );
    }
    changes.registrationOpen = body.registrationOpen;
    // El estado solo se ajusta automáticamente cuando la matriz lo permite.
    if (body.registrationOpen && !body.status && canTransition(currentStatus, "registration_open")) {
      changes.status = "registration_open";
    }
    if (!body.registrationOpen && !body.status && canTransition(currentStatus, "preparing")) {
      changes.status = "preparing";
    }
  }

  const [updated] = await db
    .update(events)
    .set(changes)
    .where(eq(events.id, current.id))
    .returning();

  await writeAuditLog({
    actor: currentUser,
    action: "event.updated",
    resourceType: "event",
    resourceId: updated.id,
    summary: `Estado del evento “${updated.title}” actualizado.`,
    details: {
      slug: updated.slug,
      status: updated.status,
      registrationOpen: updated.registrationOpen,
    },
    request,
  });
  return NextResponse.json({ data: updated });
}
