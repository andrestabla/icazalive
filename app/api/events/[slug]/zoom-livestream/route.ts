import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { canManageEvent } from "@/lib/event-permissions";
import {
  readZoomLivestreamStatus,
  startZoomLivestreamForEvent,
  stopZoomLivestreamForEvent,
  syncZoomLivestreamForEvent,
} from "@/lib/zoom-ivs-bridge";
import { enableZoomCustomLivestream } from "@/lib/zoom-livestream";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ slug: string }> };

// Zoom → Amazon IVS gestionado desde la plataforma: estado del ajuste de Zoom,
// conexión de la reunión con el canal, y arranque/parada de la emisión.

async function resolveManaged(slug: string) {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (user.role === "participant") {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }
  const [record] = await getDb()
    .select({ event: events, session: sessions })
    .from(events)
    .innerJoin(sessions, eq(sessions.eventId, events.id))
    .where(eq(events.slug, slug))
    .orderBy(sessions.startsAt)
    .limit(1);
  if (!record) {
    return { error: NextResponse.json({ error: "Evento no encontrado." }, { status: 404 }) };
  }
  if (!(await canManageEvent(user, record.event.id))) {
    return {
      error: NextResponse.json({ error: "No eres organizador de este evento." }, { status: 403 }),
    };
  }
  return { user, ...record };
}

export async function GET(_: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManaged(slug);
  if ("error" in resolved) return resolved.error;
  const status = await readZoomLivestreamStatus(resolved.session);
  return NextResponse.json({ data: status });
}

type Action = "enable_setting" | "configure" | "start" | "stop";

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManaged(slug);
  if ("error" in resolved) return resolved.error;
  const body = (await request.json().catch(() => ({}))) as { action?: Action };
  const options = { actor: resolved.user, request };

  if (resolved.session.streamingMode !== "zoom_to_ivs") {
    return NextResponse.json(
      { error: "Esta sesión no usa el modo Zoom → Amazon IVS." },
      { status: 409 },
    );
  }

  if (body.action === "enable_setting") {
    const result = await enableZoomCustomLivestream();
    await writeAuditLog({
      actor: resolved.user,
      action: result.ok ? "zoom.livestream.setting_enabled" : "zoom.livestream.setting_failed",
      resourceType: "integration",
      resourceId: "zoom",
      outcome: result.ok ? "success" : "failure",
      summary: result.ok
        ? "Transmisión personalizada habilitada en la cuenta de Zoom."
        : `No se pudo habilitar la transmisión personalizada en Zoom: ${result.detail}`,
      request,
    });
    if (!result.ok) return NextResponse.json({ error: result.detail }, { status: 502 });
    return NextResponse.json({ data: { detail: result.detail, status: await readZoomLivestreamStatus(resolved.session) } });
  }

  if (body.action === "configure") {
    const result = await syncZoomLivestreamForEvent(resolved.event.id, options);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({
      data: { detail: "Reunión de Zoom conectada al canal de Amazon IVS.", status: await readZoomLivestreamStatus(resolved.session) },
    });
  }

  if (body.action === "start" || body.action === "stop") {
    const result =
      body.action === "start"
        ? await startZoomLivestreamForEvent(resolved.event.id, options)
        : await stopZoomLivestreamForEvent(resolved.event.id, options);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ data: { detail: result.detail } });
  }

  return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
}
