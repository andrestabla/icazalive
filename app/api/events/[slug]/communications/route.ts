import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  communicationDeliveries,
  communicationMessages,
  events,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { DEFAULT_COMMUNICATIONS } from "@/lib/default-communications";
import { requireApiUser } from "@/lib/auth";
import { processDueDeliveries } from "@/lib/communication-worker";
import { ensureLiveNowMessage } from "@/lib/live-notifications";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

async function getStaffUser() {
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

export async function GET(_: Request, context: RouteContext) {
  const auth = await getStaffUser();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const db = getDb();
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  // Planificador perezoso: al consultar la pestaña se procesan las entregas
  // vencidas, de modo que confirmaciones y recordatorios avanzan sin cron.
  await processDueDeliveries(event.id);
  await ensureLiveNowMessage(event.id);

  const [messages, stats] = await Promise.all([
    db
      .select()
      .from(communicationMessages)
      .where(eq(communicationMessages.eventId, event.id))
      .orderBy(communicationMessages.createdAt),
    db
      .select({
        status: communicationDeliveries.status,
        total: count(),
      })
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.eventId, event.id))
      .groupBy(communicationDeliveries.status),
  ]);

  return NextResponse.json({ data: { messages, stats } });
}

// Precarga la secuencia estándar de la plataforma en un evento sin mensajes.
export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const auth = await getStaffUser();
  if ("error" in auth) return auth.error;

  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const existing = await db
    .select({ id: communicationMessages.id })
    .from(communicationMessages)
    .where(eq(communicationMessages.eventId, event.id))
    .limit(1);
  if (existing.length) {
    return NextResponse.json(
      { error: "El evento ya tiene plantillas de comunicación." },
      { status: 409 },
    );
  }

  await db.insert(communicationMessages).values(
    DEFAULT_COMMUNICATIONS.map((message) => ({
      eventId: event.id,
      type: message.type,
      subject: message.subject,
      body: message.body,
      enabled: message.enabled,
      offsetMinutes: message.offsetMinutes,
    })),
  );

  await writeAuditLog({
    actor: auth.user,
    action: "communication.defaults_loaded",
    resourceType: "event",
    resourceId: event.id,
    summary: `Plantillas estándar precargadas para “${event.title}”.`,
    request,
  });
  return NextResponse.json({ data: { loaded: DEFAULT_COMMUNICATIONS.length } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getStaffUser();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const body = (await request.json()) as {
    messageId?: string;
    enabled?: boolean;
    subject?: string;
    body?: string;
  };

  if (!body.messageId) {
    return NextResponse.json(
      { error: "Selecciona una comunicación." },
      { status: 400 },
    );
  }
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "El estado de la comunicación no es válido." },
      { status: 400 },
    );
  }

  const subject = body.subject?.trim();
  const messageBody = body.body?.trim();
  if (
    (body.subject !== undefined && (!subject || subject.length > 180)) ||
    (body.body !== undefined && (!messageBody || messageBody.length > 10_000))
  ) {
    return NextResponse.json(
      { error: "Revisa el asunto y el contenido del mensaje." },
      { status: 400 },
    );
  }
  if (
    body.enabled === undefined &&
    body.subject === undefined &&
    body.body === undefined
  ) {
    return NextResponse.json(
      { error: "No hay cambios para guardar." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const changes: {
    enabled?: boolean;
    subject?: string;
    body?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (body.enabled !== undefined) changes.enabled = body.enabled;
  if (subject) changes.subject = subject;
  if (messageBody) changes.body = messageBody;

  const [updated] = await db
    .update(communicationMessages)
    .set(changes)
    .where(
      and(
        eq(communicationMessages.id, body.messageId),
        eq(communicationMessages.eventId, event.id),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Comunicación no encontrada." },
      { status: 404 },
    );
  }

  await writeAuditLog({
    actor: auth.user,
    action: "communication.updated",
    resourceType: "communication",
    resourceId: updated.id,
    summary: `Comunicación ${updated.type} actualizada.`,
    details: {
      eventId: event.id,
      type: updated.type,
      enabled: updated.enabled,
      subjectChanged: body.subject !== undefined,
      bodyChanged: body.body !== undefined,
    },
    request,
  });
  return NextResponse.json({ data: updated });
}
