import { ReplitConnectors } from "@replit/connectors-sdk";

type ZoomProfile = {
  id?: string;
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  timezone?: string;
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