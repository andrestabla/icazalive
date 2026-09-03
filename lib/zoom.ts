// Cliente de Zoom con las mismas firmas que la versión desplegada en Replit
// (que usa el conector OAuth de Replit). Esta implementación local usa una app
// Server-to-Server OAuth (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET).
// NO copiar este archivo a Replit: allí manda la versión del conector.

export type ZoomProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export type ZoomMeeting = {
  id: string;
  topic: string;
  joinUrl: string;
  startAt: Date;
  durationMinutes: number;
  timezone: string | null;
};

export type ZoomMeetingUpdate = Pick<
  ZoomMeeting,
  "id" | "startAt" | "durationMinutes" | "timezone"
> & {
  joinUrl?: string;
};

export type ZoomConnectionCheck = {
  ok: boolean;
  detail: string;
  profile: ZoomProfile | null;
};

const ZOOM_API = "https://api.zoom.us/v2";

function credentials() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) return null;
  return { accountId, clientId, clientSecret };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken() {
  const creds = credentials();
  if (!creds) throw new Error("Zoom no está configurado en el servidor.");
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(creds.accountId)}`,
    { method: "POST", headers: { authorization: `Basic ${basic}` }, cache: "no-store" },
  );
  const payload = (await response.json()) as { access_token?: string; expires_in?: number; reason?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.reason ?? "Zoom rechazó las credenciales.");
  }
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function zoomFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  return fetch(`${ZOOM_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
}

function zoomErrorMessage(payload: unknown, fallback = "Zoom no pudo completar la operación.") {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}

function parseMeeting(payload: unknown): ZoomMeeting {
  const record = payload as Record<string, unknown>;
  if (!record || typeof record !== "object" || !("id" in record) || typeof record.join_url !== "string") {
    throw new Error("Zoom devolvió una reunión con un formato inesperado.");
  }
  return {
    id: String(record.id),
    topic: typeof record.topic === "string" ? record.topic : "",
    joinUrl: record.join_url,
    startAt: new Date(typeof record.start_time === "string" ? record.start_time : Date.now()),
    durationMinutes: typeof record.duration === "number" ? record.duration : 0,
    timezone: typeof record.timezone === "string" ? record.timezone : null,
  };
}

export async function checkZoomConnection(): Promise<ZoomConnectionCheck> {
  if (!credentials()) {
    return { ok: false, detail: "Faltan ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID o ZOOM_CLIENT_SECRET.", profile: null };
  }
  try {
    const response = await zoomFetch("/users/me");
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) return { ok: false, detail: zoomErrorMessage(payload), profile: null };
    return {
      ok: true,
      detail: "Conexión con Zoom verificada.",
      profile: {
        id: String(payload.id ?? ""),
        email: typeof payload.email === "string" ? payload.email : null,
        displayName: typeof payload.display_name === "string" ? payload.display_name : null,
      },
    };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "No fue posible contactar a Zoom.", profile: null };
  }
}

export async function createZoomMeeting({
  topic,
  startsAt,
  endsAt,
  timezone,
  agenda,
}: {
  topic: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  agenda?: string;
}): Promise<ZoomMeeting> {
  const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const response = await zoomFetch("/users/me/meetings", {
    method: "POST",
    body: JSON.stringify({
      topic,
      type: 2,
      start_time: startsAt.toISOString(),
      duration: durationMinutes,
      timezone,
      ...(agenda ? { agenda } : {}),
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(zoomErrorMessage(payload, "Zoom no pudo crear la reunión programada."));
  return parseMeeting(payload);
}

export async function updateZoomMeeting({
  meetingId,
  topic,
  startsAt,
  endsAt,
  timezone,
}: {
  meetingId: string;
  topic: string;
  startsAt: Date;
  endsAt: Date;
  timezone?: string;
}): Promise<void> {
  const durationMinutes = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
  const response = await zoomFetch(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      topic,
      start_time: startsAt.toISOString(),
      duration: durationMinutes,
      ...(timezone ? { timezone } : {}),
    }),
  });
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => null);
    throw new Error(zoomErrorMessage(payload, "Zoom no pudo actualizar la reunión."));
  }
}

export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const response = await zoomFetch(`/meetings/${encodeURIComponent(meetingId)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204 && response.status !== 404) {
    const payload = await response.json().catch(() => null);
    throw new Error(zoomErrorMessage(payload, "Zoom no pudo eliminar la reunión."));
  }
}

export async function listZoomMeetings(): Promise<ZoomMeeting[]> {
  const response = await zoomFetch("/users/me/meetings?type=upcoming&page_size=50");
  const payload = (await response.json()) as { meetings?: unknown[] };
  if (!response.ok) throw new Error(zoomErrorMessage(payload, "Zoom no pudo listar las reuniones."));
  return (payload.meetings ?? []).map(parseMeeting);
}
