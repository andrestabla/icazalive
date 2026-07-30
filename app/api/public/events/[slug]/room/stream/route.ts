import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getBearerToken,
  resolveRegistrationAccess,
} from "@/lib/registration-access";
import { getRoomEmitter } from "@/lib/room-events";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

// Canal Server-Sent Events: empuja un aviso inmediato cuando hay actividad
// nueva en la sala (chat, preguntas, votos, reacciones) para que el cliente
// refresque sin esperar al sondeo.
export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  const token =
    getBearerToken(request) ||
    new URL(request.url).searchParams.get("access") ||
    "";
  let authorized = false;
  if (token) {
    authorized = Boolean(await resolveRegistrationAccess(token, slug));
  }
  if (!authorized) {
    const user = await getCurrentUser();
    authorized = Boolean(user && user.role !== "participant");
  }
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const [event] = await getDb()
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const emitter = getRoomEmitter();
  const channel = `room:${event.id}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (kind: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${kind}\n\n`));
        } catch {
          cleanup();
        }
      };
      const heartbeat = setInterval(() => send("heartbeat"), 25_000);
      const cleanup = () => {
        clearInterval(heartbeat);
        emitter.off(channel, send);
      };
      emitter.on(channel, send);
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });
      send("connected");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
