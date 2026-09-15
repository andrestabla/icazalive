import { zoomApiRequest } from "@/lib/zoom";

// Transmisión personalizada (Custom Live Streaming) de una reunión de Zoom:
// permite fijar desde la plataforma el destino RTMP (el canal de Amazon IVS
// del evento) y arrancar o detener la emisión sin que el anfitrión tenga que
// copiar claves en Zoom.

export type ZoomLivestreamCapability = {
  ok: boolean;
  allowLiveStreaming: boolean;
  customService: boolean;
  detail: string;
};

export type ZoomLivestreamConfig = {
  streamUrl: string;
  streamKey: string;
  pageUrl: string;
};

type ZoomError = { code?: number; message?: string };

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ZoomError | null;
  const message = payload?.message ?? "";
  if (/scopes?:?\s*\[/i.test(message) || payload?.code === 104 || response.status === 401) {
    return `El conector de Zoom no tiene permiso para esta operación (${message || "token sin alcance"}). Vuelve a conectar Zoom en Integraciones concediendo permisos de reunión y usuario.`;
  }
  if (response.status === 404 || payload?.code === 3001) {
    return "Zoom no encuentra la reunión del evento. Verifica el ID de reunión en la configuración de transmisión.";
  }
  if (message) return `${fallback} Zoom respondió: ${message}`;
  return `${fallback} (HTTP ${response.status})`;
}

// Lee si la cuenta permite transmitir reuniones a un servicio personalizado.
export async function readZoomLivestreamCapability(): Promise<ZoomLivestreamCapability> {
  try {
    const response = await zoomApiRequest("/users/me/settings");
    if (!response.ok) {
      return {
        ok: false,
        allowLiveStreaming: false,
        customService: false,
        detail: await readError(response, "No fue posible leer la configuración de Zoom."),
      };
    }
    const payload = (await response.json()) as {
      in_meeting?: { allow_live_streaming?: boolean; custom_live_streaming_service?: boolean };
    };
    const allow = Boolean(payload.in_meeting?.allow_live_streaming);
    const custom = Boolean(payload.in_meeting?.custom_live_streaming_service);
    return {
      ok: true,
      allowLiveStreaming: allow,
      customService: custom,
      detail:
        allow && custom
          ? "Zoom permite transmitir reuniones a un servicio personalizado."
          : "Zoom todavía no permite la transmisión a un servicio personalizado en esta cuenta.",
    };
  } catch (error) {
    return {
      ok: false,
      allowLiveStreaming: false,
      customService: false,
      detail: error instanceof Error ? error.message : "No fue posible contactar a Zoom.",
    };
  }
}

// Activa en la cuenta del anfitrión la transmisión en vivo y el servicio
// personalizado. Si el administrador de Zoom bloqueó el ajuste, Zoom lo
// rechaza y se informa el motivo.
export async function enableZoomCustomLivestream(): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await zoomApiRequest("/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({
        in_meeting: { allow_live_streaming: true, custom_live_streaming_service: true },
      }),
    });
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        detail: await readError(
          response,
          "Zoom no permitió activar la transmisión personalizada; un administrador de la cuenta de Zoom debe habilitar “Allow livestreaming of meetings → Custom Live Streaming Service”.",
        ),
      };
    }
    const after = await readZoomLivestreamCapability();
    return after.allowLiveStreaming && after.customService
      ? { ok: true, detail: "Transmisión personalizada habilitada en Zoom." }
      : {
          ok: false,
          detail:
            "Zoom aceptó la petición pero el ajuste sigue desactivado: está bloqueado a nivel de cuenta. Un administrador de Zoom debe habilitar “Allow livestreaming of meetings → Custom Live Streaming Service”.",
        };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "No fue posible contactar a Zoom." };
  }
}

// Destino de transmisión guardado en la reunión (sin exponer la clave).
export async function readMeetingLivestream(
  meetingId: string,
): Promise<{ ok: true; streamUrl: string | null; pageUrl: string | null; hasKey: boolean } | { ok: false; detail: string }> {
  try {
    const response = await zoomApiRequest(`/meetings/${encodeURIComponent(meetingId)}/livestream`);
    if (!response.ok) {
      return { ok: false, detail: await readError(response, "No fue posible leer el destino de transmisión de la reunión.") };
    }
    const payload = (await response.json()) as { stream_url?: string; stream_key?: string; page_url?: string };
    return {
      ok: true,
      streamUrl: payload.stream_url || null,
      pageUrl: payload.page_url || null,
      hasKey: Boolean(payload.stream_key),
    };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "No fue posible contactar a Zoom." };
  }
}

// Fija el destino RTMP de la reunión: URL de ingesta y clave del canal de IVS.
export async function configureMeetingLivestream(
  meetingId: string,
  config: ZoomLivestreamConfig,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await zoomApiRequest(`/meetings/${encodeURIComponent(meetingId)}/livestream`, {
      method: "PATCH",
      body: JSON.stringify({
        stream_url: config.streamUrl,
        stream_key: config.streamKey,
        page_url: config.pageUrl,
      }),
    });
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        detail: await readError(
          response,
          "Zoom no aceptó el destino de transmisión. Asegúrate de que la cuenta permita la transmisión personalizada.",
        ),
      };
    }
    return { ok: true, detail: "Reunión de Zoom conectada al canal de Amazon IVS." };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "No fue posible contactar a Zoom." };
  }
}

// Arranca o detiene la emisión de la reunión hacia el destino configurado.
// Zoom exige que la reunión esté en curso (el anfitrión ya la inició).
export async function setMeetingLivestreamStatus(
  meetingId: string,
  action: "start" | "stop",
  displayName: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await zoomApiRequest(`/meetings/${encodeURIComponent(meetingId)}/livestream/status`, {
      method: "PATCH",
      body: JSON.stringify({
        action,
        ...(action === "start"
          ? { settings: { active_speaker_name: true, display_name: displayName.slice(0, 50) } }
          : {}),
      }),
    });
    if (!response.ok && response.status !== 204) {
      const payload = (await response.clone().json().catch(() => null)) as ZoomError | null;
      if (action === "start" && payload?.message && /not (started|in progress)|no.*in progress/i.test(payload.message)) {
        return {
          ok: false,
          detail: "La reunión de Zoom no está en curso. El anfitrión debe iniciarla primero; luego pulsa de nuevo “Iniciar transmisión desde Zoom”.",
        };
      }
      return {
        ok: false,
        detail: await readError(
          response,
          action === "start"
            ? "Zoom no pudo iniciar la transmisión. Verifica que la reunión esté en curso y que el destino esté configurado."
            : "Zoom no pudo detener la transmisión.",
        ),
      };
    }
    return {
      ok: true,
      detail:
        action === "start"
          ? "Zoom empezó a transmitir hacia Amazon IVS. La señal aparece en la sala en 30 a 60 segundos."
          : "Transmisión desde Zoom detenida.",
    };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "No fue posible contactar a Zoom." };
  }
}
