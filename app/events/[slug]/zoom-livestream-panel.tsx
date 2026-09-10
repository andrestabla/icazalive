"use client";

import { useCallback, useEffect, useState } from "react";
import "../zoom-livestream.css";

type Status = {
  mode: string;
  meetingId: string | null;
  joinUrl: string | null;
  channelReady: boolean;
  capability: { ok: boolean; allowLiveStreaming: boolean; customService: boolean; detail: string } | null;
  destination: { configured: boolean; matchesChannel: boolean | null; detail: string | null };
};

type Action = "enable_setting" | "configure" | "start" | "stop";

// Zoom → Amazon IVS sin pasos manuales: muestra si la cuenta de Zoom permite
// la transmisión personalizada, si la reunión ya apunta al canal del evento y
// arranca o detiene la emisión con un botón. Se usa en el detalle del evento
// y, en modo compacto, en la sala técnica.
export default function ZoomLivestreamPanel({
  slug,
  compact = false,
  onStarted,
}: {
  slug: string;
  compact?: boolean;
  onStarted?: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [streaming, setStreaming] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${slug}/zoom-livestream`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: Status };
      if (response.ok && payload.data) setStatus(payload.data);
    } catch {
      // Se reintenta en la siguiente acción.
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (action: Action) => {
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/events/${slug}/zoom-livestream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { data?: { detail: string; status?: Status }; error?: string };
      if (!response.ok) {
        setNotice({ text: payload.error ?? "No fue posible completar la acción.", error: true });
      } else {
        setNotice({ text: payload.data?.detail ?? "Listo.", error: false });
        if (payload.data?.status) setStatus(payload.data.status);
        else void refresh();
        if (action === "start") {
          setStreaming(true);
          onStarted?.();
        }
        if (action === "stop") setStreaming(false);
      }
    } catch {
      setNotice({ text: "No fue posible contactar al servidor.", error: true });
    } finally {
      setBusy(null);
    }
  };

  if (!status || status.mode !== "zoom_to_ivs") return null;

  const settingOk = Boolean(status.capability?.ok && status.capability.allowLiveStreaming && status.capability.customService);
  const settingUnknown = !status.capability?.ok;
  const destinationOk = status.destination.configured && status.destination.matchesChannel !== false;
  const ready = settingOk && Boolean(status.meetingId) && status.channelReady && destinationOk;

  return (
    <div className={`zoom-livestream${compact ? " compact" : ""}`}>
      {!compact && (
        <>
          <p className="eyebrow">ZOOM → AMAZON IVS</p>
          <p>
            La plataforma conecta la reunión de Zoom con el canal del evento y arranca la
            emisión; el anfitrión solo inicia la reunión en Zoom.
          </p>
        </>
      )}

      <ul className="zoom-livestream-steps">
        <li className={settingOk ? "done" : settingUnknown ? "warn" : ""}>
          <i>{settingOk ? "✓" : "1"}</i>
          <span>
            {settingOk
              ? "Zoom permite la transmisión personalizada."
              : status.capability?.detail ?? "Comprobando la cuenta de Zoom…"}
          </span>
          {!settingOk && (
            <button disabled={busy !== null} onClick={() => void act("enable_setting")}>
              {busy === "enable_setting" ? "Habilitando…" : "Habilitar en Zoom"}
            </button>
          )}
        </li>
        <li className={status.meetingId && status.channelReady ? "done" : ""}>
          <i>{status.meetingId && status.channelReady ? "✓" : "2"}</i>
          <span>
            {status.meetingId && status.channelReady
              ? `Reunión ${status.meetingId} y canal de IVS creados.`
              : !status.meetingId
                ? "Falta la reunión de Zoom: se crea al confirmar el evento."
                : "Falta el canal de Amazon IVS: se crea al confirmar el evento."}
          </span>
          <span />
        </li>
        <li className={destinationOk ? "done" : status.destination.matchesChannel === false ? "warn" : ""}>
          <i>{destinationOk ? "✓" : "3"}</i>
          <span>
            {destinationOk
              ? "La reunión apunta al canal del evento."
              : status.destination.matchesChannel === false
                ? "La reunión apunta a otro destino."
                : status.destination.detail ?? "La reunión todavía no tiene destino de transmisión."}
          </span>
          <button
            disabled={busy !== null || !status.meetingId || !status.channelReady}
            onClick={() => void act("configure")}
          >
            {busy === "configure" ? "Conectando…" : destinationOk ? "Reconectar" : "Conectar con el canal"}
          </button>
        </li>
      </ul>

      <div className="zoom-livestream-actions">
        {streaming ? (
          <button className="go-live stop" disabled={busy !== null} onClick={() => void act("stop")}>
            {busy === "stop" ? "Deteniendo…" : "Detener transmisión desde Zoom"}
          </button>
        ) : (
          <button className="go-live" disabled={busy !== null || !ready} onClick={() => void act("start")}>
            {busy === "start" ? "Iniciando…" : "Iniciar transmisión desde Zoom"}
          </button>
        )}
        {status.joinUrl && (
          <a href={status.joinUrl} target="_blank" rel="noreferrer">
            Abrir la reunión en Zoom ↗
          </a>
        )}
      </div>
      {!compact && (
        <p>
          El anfitrión inicia la reunión en Zoom; después, “Iniciar transmisión desde Zoom”
          envía la señal al canal. Sirve tanto para la prueba técnica como para el evento.
        </p>
      )}
      {notice && (
        <p className={`zoom-livestream-status ${notice.error ? "error" : "ok"}`} role="status">
          {notice.error ? "⚠ " : "✓ "}
          {notice.text}
        </p>
      )}
    </div>
  );
}
