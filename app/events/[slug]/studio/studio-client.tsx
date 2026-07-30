"use client";

import Link from "next/link";
import { useState } from "react";
import type { StreamingCheck, StreamingMode } from "@/lib/streaming";

type StudioSession = {
  id: string;
  title: string;
  startsAt: string;
  streamingMode: StreamingMode;
  streamingStatus:
    | "not_configured"
    | "configured"
    | "ready"
    | "live"
    | "ended"
    | "error";
  zoomMeetingId: string | null;
  ivsChannelArn: string | null;
  playbackUrl: string | null;
  technicalCheckAt: string | null;
};

export default function StudioClient({
  event,
  session: initialSession,
  initialChecks,
}: {
  event: { title: string; slug: string; timezone: string };
  session: StudioSession;
  initialChecks: StreamingCheck[];
}) {
  const [session, setSession] = useState(initialSession);
  const [checks, setChecks] = useState(initialChecks);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const statusLabels = {
    not_configured: "Configuración incompleta",
    configured: "Configurada",
    ready: "Lista localmente",
    live: "En vivo",
    ended: "Finalizada",
    error: "Con error",
  };

  const runCheck = async () => {
    setChecking(true);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/streaming`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, action: "run_check" }),
    });
    const payload = (await response.json()) as {
      data?: { session: StudioSession; checks: StreamingCheck[] };
      error?: string;
    };
    if (response.ok && payload.data) {
      setSession({
        ...payload.data.session,
        startsAt: new Date(payload.data.session.startsAt).toISOString(),
        technicalCheckAt: payload.data.session.technicalCheckAt
          ? new Date(payload.data.session.technicalCheckAt).toISOString()
          : null,
      });
      setChecks(payload.data.checks);
      setMessage(
        payload.data.checks.some((check) => check.status === "fail")
          ? "Aún hay elementos pendientes antes del ensayo."
          : "La sala está preparada para un ensayo local.",
      );
    } else {
      setMessage(payload.error ?? "No fue posible ejecutar la revisión.");
    }
    setChecking(false);
  };

  return (
    <>
      <div className="detail-breadcrumb">
        <Link href={`/events/${event.slug}`}>{event.title}</Link>
        <span>›</span>
        Sala técnica
      </div>
      <header className="studio-header">
        <div>
          <p className="eyebrow">SALA TÉCNICA LOCAL</p>
          <h1>{session.title}</h1>
          <p>Prepara la señal y revisa el recorrido antes de conectar los proveedores.</p>
        </div>
        <div className="studio-header-actions">
          <span className={`studio-status ${session.streamingStatus}`}>
            ● {statusLabels[session.streamingStatus]}
          </span>
          <Link href={`/events/${event.slug}`} className="secondary-action link-button">
            Volver al evento
          </Link>
        </div>
      </header>

      {message && <div className="detail-message" role="status">{message}</div>}

      <div className="studio-grid">
        <section className="studio-stage-card">
          <div className="studio-stage">
            <div className="studio-stage-top">
              <span>PREVISUALIZACIÓN</span>
              <i>LOCAL</i>
            </div>
            <div className="studio-stage-empty">
              <span>◉</span>
              <h2>La señal aún no está conectada</h2>
              <p>Esta vista mostrará la salida de Amazon IVS cuando estén disponibles las credenciales y el canal.</p>
            </div>
            <div className="studio-stage-bottom">
              <span>◉ {event.title}</span>
              <small>Sin emisión pública</small>
            </div>
          </div>
          <div className="studio-sources">
            <div><span className="service-logo zoom">zoom</span><p><b>Fuente Zoom</b><small>{session.zoomMeetingId ? `Reunión ${session.zoomMeetingId}` : "Sin reunión configurada"}</small></p></div>
            <div><span className="service-logo aws">aws</span><p><b>Salida Amazon IVS</b><small>{session.ivsChannelArn ? "Canal configurado" : "Sin canal configurado"}</small></p></div>
            <div><span>⌁</span><p><b>Reproducción</b><small>{session.playbackUrl ? "URL disponible" : "Pendiente"}</small></p></div>
          </div>
        </section>

        <aside className="panel studio-check-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">CONTROL PREVIO</p><h2>Revisión técnica</h2><p>Estado de la sesión en este equipo.</p></div>
          </div>
          <div className="technical-check-list">
            {checks.map((check) => (
              <div className={check.status} key={check.id}>
                <span>{check.status === "pass" ? "✓" : check.status === "warning" ? "!" : "×"}</span>
                <p><b>{check.label}</b><small>{check.detail}</small></p>
              </div>
            ))}
          </div>
          <button className="primary-button" disabled={checking} onClick={() => void runCheck()}>
            {checking ? "Verificando…" : "Ejecutar revisión"}
          </button>
          <p className="studio-safety-note">Esta acción solo valida la configuración. No inicia una transmisión ni crea recursos externos.</p>
        </aside>
      </div>
    </>
  );
}
