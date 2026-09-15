import { ReplitConnectors } from "@replit/connectors-sdk";

type ZoomProfile = {
  id?: string;
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  timezone?: string;
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

function zoomErrorMessage(
  payload: unknown,
  fallback = "Zoom no pudo completar la operación.",
) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }
  return fallback;
}

function parseMeeting(payload: unknown): ZoomMeeting {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("id" in payload) ||
    !("join_url" in payload) ||
    !("start_time" in payload) ||
    !("duration" in payload) ||
    (typeof payload.id !== "string" && typeof payload.id !== "number") ||
    typeof payload.join_url !== "string" ||
    typeof payload.start_time !== "string" ||
    typeof payload.duration !== "number"
  ) {
    throw new Error("Zoom devolvió una reunión incompleta.");
  }

  const startAt = new Date(payload.start_time);
  if (Number.isNaN(startAt.getTime())) {
    throw new Error("Zoom devolvió un horario no válido.");
  }
  return {
    id: String(payload.id),
    topic: "topic" in payload && typeof payload.topic === "string" ? payload.topic : "",
    joinUrl: payload.join_url,
    startAt,
    durationMinutes: payload.duration,
    timezone:
      "timezone" in payload && typeof payload.timezone === "string"
        ? payload.timezone
        : null,
  };
}

export async function checkZoomConnection(): Promise<ZoomConnectionCheck> {
  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy("zoom", "/users/me", {
      method: "GET",
    });
    const payload = (await response.json()) as ZoomProfile & {
      code?: number;
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        detail: zoomErrorMessage(payload),
        profile: null,
      };
    }

    return {
      ok: true,
      detail: "La cuenta de Zoom respondió correctamente.",
      profile: payload,
    };
  } catch {
    return {
      ok: false,
      detail: "No fue posible contactar la conexión segura de Zoom.",
      profile: null,
    };
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
}) {
  const durationMinutes = Math.round(
    (endsAt.getTime() - startsAt.getTime()) / 60_000,
  );
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("zoom", "/users/me/meetings", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  if (!response.ok) {
    throw new Error(
      zoomErrorMessage(payload, "Zoom no pudo crear la reunión programada."),
    );
  }
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
}): Promise<ZoomMeetingUpdate> {
  const durationMinutes = Math.round(
    (endsAt.getTime() - startsAt.getTime()) / 60_000,
  );
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "zoom",
    `/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic,
        start_time: startsAt.toISOString(),
        duration: durationMinutes,
        ...(timezone ? { timezone } : {}),
      }),
    },
  );
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(zoomErrorMessage(payload, "Zoom no pudo actualizar la reunión."));
  }
  return {
    id: meetingId,
    startAt: startsAt,
    durationMinutes,
    timezone: timezone ?? null,
  };
}

export async function deleteZoomMeeting(meetingId: string) {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "zoom",
    `/meetings/${encodeURIComponent(meetingId)}`,
    { method: "DELETE" },
  );
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok && response.status !== 404) {
    throw new Error(zoomErrorMessage(payload));
  }
}

export async function listZoomMeetings() {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "zoom",
    "/users/me/meetings?type=upcoming&page_size=100",
    { method: "GET" },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(zoomErrorMessage(payload));
  }
  return payload as {
    meetings?: Array<{
      id: number;
      topic: string;
      start_time?: string;
      duration?: number;
      timezone?: string;
      join_url?: string;
      agenda?: string;
    }>;
    next_page_token?: string;
  };
}
// Acceso genérico a la API v2 de Zoom a través del conector administrado de Replit.
export async function zoomApiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const connectors = new ReplitConnectors();
  const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
  return connectors.proxy("zoom", path, { method: init.method ?? "GET", body });
}
