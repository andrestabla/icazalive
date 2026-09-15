"use client";

import Link from "next/link";
import { useState } from "react";
import StudioTechnicalTest from "./studio-technical-test";
import { ServiceLogo } from "@/app/components/service-logo";
import { AdminIcon } from "@/app/components/admin-icon";
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
  emitterStatus: "idle" | "starting" | "running" | "stopping" | "stopped" | "error";
};

export default function StudioClient({
  event,
  session: initialSession,
  initialChecks,
}: {
  event: { title: string; slug: string; timezone: string; status: string; format: string };
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
    ready: "Lista",
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
        <span><AdminIcon name="arrow-right" /></span>
        Sala técnica
      </div>
      <header className="studio-header">
        <div>
          <p className="eyebrow">SALA TÉCNICA</p>
          <h1>{session.title}</h1>
          <p>Prepara la señal y revisa el recorrido antes de salir al aire.</p>
        </div>
        <div className="studio-header-actions">
          <span className={`studio-status ${session.streamingStatus}`}>
            <AdminIcon name={session.streamingStatus === "live" ? "event-live" : session.streamingStatus === "ready" ? "check" : session.streamingStatus === "error" ? "close" : "activity"} /> {statusLabels[session.streamingStatus]}
          </span>
          <Link href={`/events/${event.slug}`} className="secondary-action link-button">
            Volver al evento
          </Link>
        </div>
      </header>

      {message && <div className="detail-message" role="status">{message}</div>}

      <div className="studio-grid">
        <section className="studio-stage-card">
          <StudioTechnicalTest event={event} session={session} />
          <div className="studio-sources">
            <div><ServiceLogo service="zoom" /><p><b>Fuente Zoom</b><small>{session.zoomMeetingId ? `Reunión ${session.zoomMeetingId}` : "Sin reunión configurada"}</small></p></div>
            <div><ServiceLogo service="amazon_ivs" /><p><b>Salida Amazon IVS</b><small>{session.ivsChannelArn ? "Canal configurado" : "Sin canal configurado"}</small></p></div>
            <div><span><AdminIcon name="event-simulated" /></span><p><b>Reproducción</b><small>{session.playbackUrl ? "URL disponible" : "Pendiente"}</small></p></div>
          </div>
        </section>

        <aside className="panel studio-check-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">CONTROL PREVIO</p><h2>Revisión técnica</h2><p>Estado de la sesión.</p></div>
          </div>
          <div className="technical-check-list">
            {checks.map((check) => (
              <div className={check.status} key={check.id}>
                <span><AdminIcon name={check.status === "pass" ? "check" : check.status === "warning" ? "warning" : "close"} /></span>
                <p><b>{check.label}</b><small>{check.detail}</small></p>
              </div>
            ))}
          </div>
          <button className="primary-button" disabled={checking} onClick={() => void runCheck()}>
            {checking ? "Verificando…" : "Ejecutar revisión"}
          </button>
          <p className="studio-safety-note">La revisión valida la configuración. La prueba técnica del escenario emite por Amazon IVS solo para el organizador: no cambia el estado del evento ni notifica a los inscritos; al llegar la hora, la automatización reinicia el contenido desde el comienzo.</p>
        </aside>
      </div>
    </>
  );
}
