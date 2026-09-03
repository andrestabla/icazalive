import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { canManageEvent } from "@/lib/event-permissions";
import { describeEmitter, readEcsConfig } from "@/lib/aws-ecs";
import { startEventEmitter, stopEventEmitter } from "@/lib/simulated-emitter";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ slug: string }> };

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
  const { session } = resolved;

  let liveState = session.emitterStatus;
  const ecs = readEcsConfig();
  if (ecs && session.emitterTaskArn && session.emitterStatus === "running") {
    const described = await describeEmitter(ecs, session.emitterTaskArn);
    if (described.ok && described.state === "stopped") {
      liveState = "stopped";
      await getDb()
        .update(sessions)
        .set({ emitterStatus: "stopped", updatedAt: new Date() })
        .where(eq(sessions.id, session.id));
    }
  }
  // Comprueba la señal real del canal: IVS responde 200 solo mientras recibe
  // stream, así que sirve como verificación de la prueba técnica.
  let signal: "live" | "offline" | "unknown" = "unknown";
  if (session.playbackUrl) {
    try {
      const probe = await fetch(session.playbackUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(4_000),
      });
      signal = probe.ok ? "live" : "offline";
    } catch {
      signal = "unknown";
    }
  }
  return NextResponse.json({
    data: {
      status: liveState,
      signal,
      playbackUrl: session.playbackUrl,
      ecsConfigured: Boolean(ecs),
      contentConfigured: Boolean(resolved.event.contentAssetId),
      startedAt: session.emitterStartedAt,
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManaged(slug);
  if ("error" in resolved) return resolved.error;
  const { user, event } = resolved;
  const body = (await request.json().catch(() => ({}))) as { action?: "start" | "stop" };
  const result =
    body.action === "stop"
      ? await stopEventEmitter(event, { actor: user, request })
      : await startEventEmitter(event, { actor: user, request });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code });
  return NextResponse.json({ data: { status: result.status, playbackUrl: result.playbackUrl ?? null } });
}
