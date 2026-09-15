import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events, users } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { canManageEvent } from "@/lib/event-permissions";
import { resolveEventSchedulingUrl } from "@/lib/scheduling-link";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ slug: string }> };

// Enlace de agendamiento que usará el seguimiento posterior de este evento
// (el del propietario) y el del usuario actual, para editarlo desde la
// pestaña Comunicaciones.
export async function GET(_: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (user.role === "participant") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const { slug } = await context.params;
  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  if (!(await canManageEvent(user, event.id))) {
    return NextResponse.json({ error: "No eres organizador de este evento." }, { status: 403 });
  }
  const [me] = await db.select({ url: users.schedulingUrl }).from(users).where(eq(users.id, user.id)).limit(1);
  const resolved = await resolveEventSchedulingUrl(event.id);
  return NextResponse.json({
    data: { eventUrl: resolved.url, ownerName: resolved.ownerName, mine: me?.url ?? null },
  });
}
