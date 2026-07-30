import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { eventOrganizers, events, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser, type AuthenticatedUser } from "@/lib/auth";
import { isEventOwner } from "@/lib/event-permissions";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

async function resolveEvent(slug: string) {
  const [event] = await getDb()
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  return event ?? null;
}

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

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const event = await resolveEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const db = getDb();
  const [organizers, staff] = await Promise.all([
    db
      .select({
        userId: eventOrganizers.userId,
        role: eventOrganizers.role,
        name: users.name,
        email: users.email,
        active: users.active,
        assignedAt: eventOrganizers.createdAt,
      })
      .from(eventOrganizers)
      .innerJoin(users, eq(eventOrganizers.userId, users.id))
      .where(eq(eventOrganizers.eventId, event.id))
      .orderBy(asc(eventOrganizers.createdAt)),
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(
        and(
          inArray(users.role, ["administrator", "organizer"]),
          eq(users.active, true),
        ),
      )
      .orderBy(asc(users.name)),
  ]);

  return NextResponse.json({
    data: {
      organizers,
      availableStaff: staff.filter(
        (member) => !organizers.some((organizer) => organizer.userId === member.id),
      ),
      canManage: await isEventOwner(auth.user, event.id),
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const event = await resolveEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (!(await isEventOwner(auth.user, event.id))) {
    return NextResponse.json(
      { error: "Solo el propietario del evento o un administrador puede asignar organizadores." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { userId?: string };
  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "Usuario no válido." }, { status: 400 });
  }

  const db = getDb();
  const [member] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.id, body.userId), eq(users.active, true)))
    .limit(1);
  if (!member || member.role === "participant") {
    return NextResponse.json(
      { error: "Solo cuentas de equipo activas pueden ser organizadoras." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(eventOrganizers)
    .values({ eventId: event.id, userId: member.id, role: "co_organizer" })
    .onConflictDoNothing()
    .returning();
  if (!created) {
    return NextResponse.json(
      { error: "Esa persona ya es organizadora del evento." },
      { status: 409 },
    );
  }

  await writeAuditLog({
    actor: auth.user,
    action: "event.organizer.added",
    resourceType: "event",
    resourceId: event.id,
    summary: `${member.email} asignado como coorganizador de “${event.title}”.`,
    details: { userId: member.id },
    request,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const event = await resolveEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (!(await isEventOwner(auth.user, event.id))) {
    return NextResponse.json(
      { error: "Solo el propietario del evento o un administrador puede transferir la propiedad." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { userId?: string; action?: string };
  if (body.action !== "transfer_ownership" || !body.userId) {
    return NextResponse.json({ error: "La acción no es válida." }, { status: 400 });
  }

  const db = getDb();
  const [target] = await db
    .select({ userId: eventOrganizers.userId })
    .from(eventOrganizers)
    .where(
      and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.userId, body.userId),
      ),
    )
    .limit(1);
  if (!target) {
    return NextResponse.json(
      { error: "La persona debe ser organizadora del evento antes de recibir la propiedad." },
      { status: 400 },
    );
  }

  await db.transaction(async (transaction) => {
    await transaction
      .update(eventOrganizers)
      .set({ role: "co_organizer" })
      .where(
        and(
          eq(eventOrganizers.eventId, event.id),
          eq(eventOrganizers.role, "owner"),
        ),
      );
    await transaction
      .update(eventOrganizers)
      .set({ role: "owner" })
      .where(
        and(
          eq(eventOrganizers.eventId, event.id),
          eq(eventOrganizers.userId, body.userId!),
        ),
      );
  });

  await writeAuditLog({
    actor: auth.user,
    action: "event.organizer.ownership_transferred",
    resourceType: "event",
    resourceId: event.id,
    summary: `Propiedad de “${event.title}” transferida.`,
    details: { newOwnerId: body.userId },
    request,
  });
  return NextResponse.json({ data: { transferred: true } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const event = await resolveEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (!(await isEventOwner(auth.user, event.id))) {
    return NextResponse.json(
      { error: "Solo el propietario del evento o un administrador puede retirar organizadores." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { userId?: string };
  if (!body.userId) {
    return NextResponse.json({ error: "Usuario no válido." }, { status: 400 });
  }

  const db = getDb();
  const [membership] = await db
    .select({ id: eventOrganizers.id, role: eventOrganizers.role })
    .from(eventOrganizers)
    .where(
      and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.userId, body.userId),
      ),
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: "Organizador no encontrado." }, { status: 404 });
  }
  if (membership.role === "owner") {
    return NextResponse.json(
      { error: "Transfiere la propiedad antes de retirar al propietario." },
      { status: 409 },
    );
  }

  await db.delete(eventOrganizers).where(eq(eventOrganizers.id, membership.id));
  await writeAuditLog({
    actor: auth.user,
    action: "event.organizer.removed",
    resourceType: "event",
    resourceId: event.id,
    summary: `Coorganizador retirado de “${event.title}”.`,
    details: { userId: body.userId },
    request,
  });
  return NextResponse.json({ data: { removed: true } });
}
