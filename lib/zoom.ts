import { ReplitConnectors } from "@replit/connectors-sdk";

type ZoomProfile = {
  id?: string;
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  timezone?: string;
};

type ZoomMeeting = {
  id: number;
  topic: string;
  start_time?: string;
  duration?: number;
  timezone?: string;
  join_url?: string;
  start_url?: string;
  agenda?: string;
};

export type ZoomConnectionCheck = {
  ok: boolean;
  detail: string;
  profile: ZoomProfile | null;
};

function zoomErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }
  return "Zoom no pudo validar la conexión.";
}

function formatZoomLocalDateTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
}

async function readZoomResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function meetingPayload(
  meeting: Pick<ZoomMeeting, "topic"> & {
    startsAt: Date;
    endsAt: Date;
    timeZone: string;
  },
) {
  return {
    topic: meeting.topic,
    type: 2,
    start_time: formatZoomLocalDateTime(meeting.startsAt, meeting.timeZone),
    duration: Math.min(
      1440,
      Math.max(
        1,
        Math.ceil(
          (meeting.endsAt.getTime() - meeting.startsAt.getTime()) / 60000,
        ),
      ),
    ),
    timezone: meeting.timeZone,
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

export async function createZoomMeeting(
  meeting: Pick<ZoomMeeting, "topic"> & {
    startsAt: Date;
    endsAt: Date;
    timeZone: string;
  },
) {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("zoom", "/users/me/meetings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(meetingPayload(meeting)),
  });
  const payload = await readZoomResponse(response);
  if (!response.ok) {
    throw new Error(zoomErrorMessage(payload));
  }
  return payload as ZoomMeeting;
}

export async function updateZoomMeeting(
  meetingId: string,
  meeting: Pick<ZoomMeeting, "topic"> & {
    startsAt: Date;
    endsAt: Date;
    timeZone: string;
  },
) {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "zoom",
    `/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(meetingPayload(meeting)),
    },
  );
  const payload = await readZoomResponse(response);
  if (!response.ok) {
    throw new Error(zoomErrorMessage(payload));
  }
}

export async function deleteZoomMeeting(meetingId: string) {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "zoom",
    `/meetings/${encodeURIComponent(meetingId)}`,
    { method: "DELETE" },
  );
  const payload = await readZoomResponse(response);
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