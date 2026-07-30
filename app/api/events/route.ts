import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
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
  };

  const title = body.title?.trim();
  const formats = ["live", "simulated", "hybrid"] as const;
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;

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
      })
      .returning();

    await transaction.insert(sessions).values({
      eventId: event.id,
      title: "Sesión principal",
      startsAt,
      endsAt,
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
