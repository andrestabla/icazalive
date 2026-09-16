"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import IvsPlayer from "@/app/room/[slug]/ivs-player";
import ZoomLivestreamPanel from "../zoom-livestream-panel";
import RoomModulesPanel from "../room-modules-panel";

type EmitterState = {
  status: "idle" | "starting" | "running" | "stopping" | "stopped" | "error";
  signal: "live" | "offline" | "unknown";
  playbackUrl: string | null;
  ecsConfigured: boolean;
  contentConfigured: boolean;
  startedAt?: string | null;
  durationSeconds?: number | null;
  serverTime?: string;
};

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

// Prueba técnica real en la sala técnica: arranca el emisor S3→IVS del evento
// y muestra la señal tal como la verá el participante, sin cambiar el estado
// del evento ni notificar a los inscritos. Sondea el emisor cada 5 segundos.
export default function StudioTechnicalTest({
  event,
  session,
}: {
  event: { title: string; slug: string; status: string; format: string };
  session: { streamingMode: string; playbackUrl: string | null; emitterStatus: string };
}) {
  const [emitter, setEmitter] = useState<EmitterState>({
    status: (session.emitterStatus as EmitterState["status"]) ?? "idle",
    signal: "unknown",
    playbackUrl: session.playbackUrl,
    ecsConfigured: true,
    contentConfigured: true,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  // Reloj local para la línea de tiempo (se corrige con la hora del servidor).
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (emitter.serverTime) setClockOffset(new Date(emitter.serverTime).getTime() - Date.now());
  }, [emitter.serverTime]);
  const [closing, setClosing] = useState(false);
  const closeRoom = async () => {
    if (!window.confirm("¿Cerrar la sala y finalizar el evento?\n\nSe detiene la emisión, los participantes verán el mensaje de cierre y el evento quedará completado. No se puede deshacer.")) return;
    setClosing(true);
    setNotice("");
    try {
      if (emitter.status === "running" || emitter.status === "starting") {
        await fetch(`/api/events/${event.slug}/emitter`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "stop" }) });
      }
      const response = await fetch(`/api/events/${event.slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(payload.error ?? "No fue posible cerrar la sala.");
        setClosing(false);
        return;
      }
      window.location.reload();
    } catch {
      setNotice("No fue posible contactar al servidor.");
      setClosing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/events/${event.slug}/emitter`, { cache: "no-store" });
        const payload = (await response.json()) as { data?: EmitterState; error?: string };
        if (!cancelled && response.ok && payload.data) setEmitter(payload.data);
      } catch {
        // El siguiente sondeo lo reintenta.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [event.slug]);

  const act = async (action: "start" | "stop") => {
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/events/${event.slug}/emitter`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json()) as {
      data?: { status: EmitterState["status"]; playbackUrl: string | null };
      error?: string;
    };
    if (response.ok && payload.data) {
      setEmitter((current) => ({
        ...current,
        status: payload.data!.status,
        playbackUrl: payload.data!.playbackUrl ?? current.playbackUrl,
        signal: action === "stop" ? "offline" : current.signal,
      }));
      setNotice(
        action === "start"
          ? "Emisor iniciado. La señal tarda entre 30 y 60 segundos en aparecer."
          : "Prueba detenida. Los participantes no fueron afectados.",
      );
    } else {
      setNotice(payload.error ?? "No fue posible ejecutar la acción.");
    }
    setBusy(false);
  };

  const isPublic = event.status === "live";
  const simulated = event.format === "simulated" || event.format === "hybrid";
  const running = emitter.status === "running" || emitter.status === "starting";
  const showPlayer = emitter.signal === "live" && Boolean(emitter.playbackUrl);
  const startedMs = emitter.startedAt ? new Date(emitter.startedAt).getTime() : null;
  const elapsed = startedMs !== null && running ? Math.max(0, (now + clockOffset - startedMs) / 1000) : null;
  const duration = emitter.durationSeconds ?? null;
  const showTimeline = simulated && running && elapsed !== null;
  const progress = showTimeline && duration ? Math.min(100, (elapsed / duration) * 100) : null;

  return (
    <div className="studio-stage">
      <div className="studio-stage-top">
        <span style={{ color: isPublic ? "#ff6a7f" : showPlayer ? "#8be0a4" : undefined }}>
          {isPublic ? "● EN VIVO · EMISIÓN PÚBLICA" : showPlayer ? "● PRUEBA TÉCNICA · SEÑAL ACTIVA" : "○ PRUEBA TÉCNICA"}
        </span>
        <i>{isPublic ? "PÚBLICO" : "SIN EMISIÓN PÚBLICA"}</i>
      </div>

      {showPlayer ? (
        <IvsPlayer playbackUrl={emitter.playbackUrl!} />
      ) : (
        <div className="studio-stage-empty">
          <span>◉</span>
          <h2>
            {running
              ? "Conectando con la señal…"
              : !emitter.ecsConfigured
                ? "El emisor no está configurado"
                : simulated && !emitter.contentConfigured
                  ? "Asigna un contenido al evento"
                  : "La señal aún no está activa"}
          </h2>
          <p>
            {running
              ? "El emisor ya arrancó; la señal de Amazon IVS aparece aquí en menos de un minuto."
              : simulated
                ? "Inicia la prueba técnica para emitir el contenido del evento por Amazon IVS y verlo tal como lo verá el participante."
                : session.streamingMode === "ivs_direct"
                  ? "Cuando el encoder envíe señal al canal de Amazon IVS se verá aquí."
                  : "Cuando Zoom empiece a enviar señal al canal de Amazon IVS se verá aquí."}
          </p>
        </div>
      )}

      {showTimeline && (
        <div className="studio-timeline" aria-label="Avance del contenido">
          <div className="studio-timeline-bar"><span style={{ width: `${progress ?? 0}%` }} /></div>
          <div className="studio-timeline-labels">
            <b>{formatClock(elapsed!)}{duration ? ` / ${formatClock(duration)}` : ""}</b>
            <small>
              {duration
                ? elapsed! >= duration
                  ? "El contenido terminó; el evento se completa solo."
                  : `Faltan ${formatClock(duration - elapsed!)} de contenido`
                : "Duración del contenido no disponible"}
            </small>
          </div>
        </div>
      )}
      <div className="studio-stage-bottom">
        <span>◉ {event.title}</span>
        <small style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {simulated && emitter.ecsConfigured && (running ? (
            <button className="content-remove" disabled={busy} onClick={() => void act("stop")}>
              {isPublic ? "Detener emisión" : "Detener prueba"}
            </button>
          ) : (
            <button
              className="secondary-action"
              disabled={busy || !emitter.contentConfigured}
              onClick={() => void act("start")}
            >
              Iniciar prueba técnica
            </button>
          ))}
          <Link href={`/room/${event.slug}`} target="_blank" className="secondary-action link-button">
            Ver como participante ↗
          </Link>
          {isPublic && (
            <button className="content-remove studio-close-room" disabled={busy || closing} onClick={() => void closeRoom()}>
              {closing ? "Cerrando…" : "Cerrar la sala"}
            </button>
          )}
        </small>
      </div>
      {notice && <p className="studio-safety-note" role="status" style={{ margin: "8px 0 0" }}>{notice}</p>}
      {session.streamingMode === "zoom_to_ivs" && <ZoomLivestreamPanel slug={event.slug} compact />}
      <RoomModulesPanel slug={event.slug} compact />
    </div>
  );
}
