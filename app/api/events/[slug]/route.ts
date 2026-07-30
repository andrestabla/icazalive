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

  const db = getDb();
  const changes: {
    status?: (typeof allowedStatuses)[number];
    registrationOpen?: boolean;
    selfServiceCutoffMinutes?: number;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (body.selfServiceCutoffMinutes !== undefined) {
    changes.selfServiceCutoffMinutes = body.selfServiceCutoffMinutes;
  }

  if (body.status) {
    changes.status = body.status as (typeof allowedStatuses)[number];
  }
  if (body.registrationOpen !== undefined) {
    changes.registrationOpen = body.registrationOpen;
    if (body.registrationOpen && !body.status) changes.status = "registration_open";
    if (!body.registrationOpen && !body.status) changes.status = "preparing";
  }

  const [updated] = await db
    .update(events)
    .set(changes)
    .where(eq(events.slug, slug))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

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
