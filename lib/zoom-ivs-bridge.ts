import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";

type Session = typeof sessions.$inferSelect;
import { writeAuditLog } from "@/lib/audit";
import type { AuthenticatedUser } from "@/lib/auth";
import { getBroadcastDetails, getChannelInfo, readIvsCredentials } from "@/lib/aws-ivs";
import { openSecret } from "@/lib/secret-box";
import {
  configureMeetingLivestream,
  readMeetingLivestream,
  readZoomLivestreamCapability,
  setMeetingLivestreamStatus,
} from "@/lib/zoom-livestream";

// Puente Zoom → IVS: con la reunión y el canal del evento ya creados, la
// plataforma fija en Zoom el destino RTMP del canal y puede arrancar la
// emisión. El organizador no copia claves a mano.

type Options = { actor?: AuthenticatedUser | null; request?: Request };

export type BroadcastDetails = {
  ingestEndpoint: string;
  streamKey: string;
  playbackUrl: string;
};

// Origen público sin petición a mano (tareas en segundo plano).
function publicOrigin(): string {
  return (
    process.env.APP_BASE_URL?.trim().replace(/\/+$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    "https://liveicazajammoul.com"
  );
}

// Ingesta y clave del canal: primero se piden a IVS; si la cuenta no permite
// leer la clave, se usa la copia cifrada guardada al crear el canal.
export async function resolveBroadcastDetails(
  session: Pick<Session, "ivsChannelArn" | "ivsStreamKeyEncrypted" | "playbackUrl">,
): Promise<{ ok: true; details: BroadcastDetails } | { ok: false; error: string }> {
  if (!session.ivsChannelArn) {
    return { ok: false, error: "Este evento todavía no tiene canal de Amazon IVS." };
  }
  const credentials = readIvsCredentials();
  if (!credentials) {
    return { ok: false, error: "Faltan las credenciales de AWS en el servidor." };
  }
  const details = await getBroadcastDetails(credentials, session.ivsChannelArn);
  if (details.ok) {
    return {
      ok: true,
      details: {
        ingestEndpoint: details.ingestEndpoint,
        streamKey: details.streamKey,
        playbackUrl: details.playbackUrl,
      },
    };
  }
  const guardada = openSecret(session.ivsStreamKeyEncrypted);
  if (!guardada) {
    return {
      ok: false,
      error: `${details.error} Tampoco hay una copia cifrada de la clave: vuelve a aprovisionar el canal o concede ivs:ListStreamKeys al usuario de AWS.`,
    };
  }
  const info = await getChannelInfo(credentials, session.ivsChannelArn);
  if (!info.ok) return { ok: false, error: info.error };
  return {
    ok: true,
    details: {
      ingestEndpoint: info.ingestEndpoint,
      streamKey: guardada,
      playbackUrl: info.playbackUrl || session.playbackUrl || "",
    },
  };
}

async function loadEventSession(eventId: string) {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return null;
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.eventId, eventId))
    .orderBy(asc(sessions.startsAt))
    .limit(1);
  if (!session) return null;
  return { event, session };
}

// Conecta la reunión con el canal. Devuelve ok:false con motivo cuando falta
// alguna pieza; se llama automáticamente al crear la reunión o el canal y
// bajo demanda desde el panel del evento.
export async function syncZoomLivestreamForEvent(eventId: string, options: Options = {}) {
  const record = await loadEventSession(eventId);
  if (!record) return { ok: false as const, error: "Evento no encontrado." };
  const { event, session } = record;
  if (session.streamingMode !== "zoom_to_ivs") {
    return { ok: false as const, error: "La sesión no usa el modo Zoom → Amazon IVS." };
  }
  if (!session.zoomMeetingId) {
    return { ok: false as const, error: "El evento todavía no tiene reunión de Zoom." };
  }
  const resolved = await resolveBroadcastDetails(session);
  if (!resolved.ok) return { ok: false as const, error: resolved.error };

  const result = await configureMeetingLivestream(session.zoomMeetingId, {
    streamUrl: resolved.details.ingestEndpoint,
    streamKey: resolved.details.streamKey,
    pageUrl: `${publicOrigin()}/room/${event.slug}`,
  });
  await writeAuditLog({
    actor: options.actor ?? undefined,
    action: result.ok ? "zoom.livestream.configured" : "zoom.livestream.failed",
    resourceType: "session",
    resourceId: session.id,
    outcome: result.ok ? undefined : "failure",
    summary: result.ok
      ? `Reunión de Zoom ${session.zoomMeetingId} conectada al canal de IVS de “${event.title}”.`
      : `No se pudo conectar Zoom con IVS en “${event.title}”: ${result.detail}`,
    details: { meetingId: session.zoomMeetingId, channelArn: session.ivsChannelArn },
    request: options.request,
  });
  if (!result.ok) console.error("[zoom→ivs] configurar", result.detail);
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.detail };
}

export type ZoomLivestreamStatus = {
  mode: string;
  meetingId: string | null;
  joinUrl: string | null;
  channelReady: boolean;
  capability: Awaited<ReturnType<typeof readZoomLivestreamCapability>> | null;
  destination: { configured: boolean; matchesChannel: boolean | null; detail: string | null };
};

// Estado para el panel: ajuste de cuenta, reunión, canal y si el destino de
// la reunión ya apunta al canal del evento.
export async function readZoomLivestreamStatus(
  session: Pick<Session, "streamingMode" | "zoomMeetingId" | "zoomJoinUrl" | "ivsChannelArn" | "ivsStreamKeyEncrypted" | "playbackUrl">,
): Promise<ZoomLivestreamStatus> {
  const status: ZoomLivestreamStatus = {
    mode: session.streamingMode,
    meetingId: session.zoomMeetingId,
    joinUrl: session.zoomJoinUrl,
    channelReady: Boolean(session.ivsChannelArn),
    capability: null,
    destination: { configured: false, matchesChannel: null, detail: null },
  };
  if (session.streamingMode !== "zoom_to_ivs") return status;
  status.capability = await readZoomLivestreamCapability();
  if (!session.zoomMeetingId) return status;
  const current = await readMeetingLivestream(session.zoomMeetingId);
  if (!current.ok) {
    status.destination = { configured: false, matchesChannel: null, detail: current.detail };
    return status;
  }
  status.destination.configured = Boolean(current.streamUrl && current.hasKey);
  if (status.destination.configured && session.ivsChannelArn) {
    const credentials = readIvsCredentials();
    if (credentials) {
      const info = await getChannelInfo(credentials, session.ivsChannelArn);
      if (info.ok) status.destination.matchesChannel = current.streamUrl === info.ingestEndpoint;
    }
  }
  return status;
}

export async function startZoomLivestreamForEvent(eventId: string, options: Options = {}) {
  const record = await loadEventSession(eventId);
  if (!record?.session.zoomMeetingId) {
    return { ok: false as const, error: "El evento todavía no tiene reunión de Zoom." };
  }
  const result = await setMeetingLivestreamStatus(record.session.zoomMeetingId, "start", record.event.title);
  await writeAuditLog({
    actor: options.actor ?? undefined,
    action: result.ok ? "zoom.livestream.started" : "zoom.livestream.start_failed",
    resourceType: "session",
    resourceId: record.session.id,
    outcome: result.ok ? undefined : "failure",
    summary: result.ok
      ? `Transmisión Zoom → IVS iniciada en “${record.event.title}”.`
      : `No se pudo iniciar la transmisión Zoom → IVS en “${record.event.title}”: ${result.detail}`,
    request: options.request,
  });
  return result.ok ? { ok: true as const, detail: result.detail } : { ok: false as const, error: result.detail };
}

export async function stopZoomLivestreamForEvent(eventId: string, options: Options = {}) {
  const record = await loadEventSession(eventId);
  if (!record?.session.zoomMeetingId) {
    return { ok: false as const, error: "El evento todavía no tiene reunión de Zoom." };
  }
  const result = await setMeetingLivestreamStatus(record.session.zoomMeetingId, "stop", record.event.title);
  await writeAuditLog({
    actor: options.actor ?? undefined,
    action: result.ok ? "zoom.livestream.stopped" : "zoom.livestream.stop_failed",
    resourceType: "session",
    resourceId: record.session.id,
    outcome: result.ok ? undefined : "failure",
    summary: result.ok
      ? `Transmisión Zoom → IVS detenida en “${record.event.title}”.`
      : `No se pudo detener la transmisión Zoom → IVS en “${record.event.title}”: ${result.detail}`,
    request: options.request,
  });
  return result.ok ? { ok: true as const, detail: result.detail } : { ok: false as const, error: result.detail };
}
