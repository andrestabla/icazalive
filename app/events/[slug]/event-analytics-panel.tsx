"use client";

import { useEffect, useState } from "react";
import type { EventAnalytics } from "@/lib/event-analytics";

const pollStatusLabels = {
  draft: "Borrador",
  open: "Abierta",
  closed: "Cerrada",
};

function formatTimelineDate(value: string) {
  const [year, month, day] = value.split("-");
  const monthLabels = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${Number(day)} ${monthLabels[Number(month) - 1] ?? month} ${year}`;
}

export default function EventAnalyticsPanel({
  slug,
  maxAttendees,
}: {
  slug: string;
  maxAttendees: number;
}) {
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/events/${slug}/analytics`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: { analytics: EventAnalytics };
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "No fue posible cargar la analítica.");
        }
        if (!cancelled) setAnalytics(payload.data.analytics);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No fue posible cargar la analítica.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <section className="panel analytics-state error" role="alert">
        <span>!</span>
        <h2>Analítica no disponible</h2>
        <p>{error}</p>
      </section>
    );
  }

  if (!analytics) {
    return (
      <section className="panel analytics-state" aria-live="polite">
        <span className="analytics-loader" />
        <h2>Calculando métricas locales…</h2>
        <p>Estamos consolidando registro, interacción y preparación técnica.</p>
      </section>
    );
  }

  const { registration, interaction, communications, streaming } = analytics;
  const confirmedRate = registration.total
    ? Math.round((registration.confirmed / registration.total) * 100)
    : 0;
  const readyMessages = communications.queued + communications.scheduled;
  const funnel = [
    { label: "Registrados", value: registration.total },
    { label: "Confirmados", value: registration.confirmed },
    { label: "Visitaron la sala", value: registration.roomVisitors },
    { label: "Asistieron", value: registration.attended },
  ];
  const timeline = analytics.registrationTimeline.slice(-12);
  const timelineMaximum = Math.max(
    1,
    ...timeline.map((point) => point.total),
  );

  return (
    <div className="event-analytics print-report">
      <div className="analytics-print-bar">
        <p>Informe del evento generado localmente.</p>
        <button type="button" onClick={() => window.print()}>
          Imprimir / guardar PDF ⎙
        </button>
      </div>
      <section className="analytics-kpis" aria-label="Métricas del evento">
        <article>
          <span className="analytics-kpi-icon purple">♙</span>
          <div>
            <small>REGISTRADOS</small>
            <strong>{registration.total.toLocaleString("es-CO")}</strong>
            <p>de {maxAttendees.toLocaleString("es-CO")} cupos</p>
          </div>
        </article>
        <article>
          <span className="analytics-kpi-icon blue">↗</span>
          <div>
            <small>VISITARON LA SALA</small>
            <strong>{registration.roomVisitors.toLocaleString("es-CO")}</strong>
            <p>accesos individuales usados</p>
          </div>
        </article>
        <article>
          <span className="analytics-kpi-icon green">◎</span>
          <div>
            <small>PARTICIPACIÓN</small>
            <strong>{interaction.participationRate}%</strong>
            <p>{interaction.uniqueParticipants} participantes activos</p>
          </div>
        </article>
        <article>
          <span className="analytics-kpi-icon amber">✉</span>
          <div>
            <small>MENSAJES PREPARADOS</small>
            <strong>{readyMessages.toLocaleString("es-CO")}</strong>
            <p>{communications.sent} enviados · {communications.failed} con error</p>
          </div>
        </article>
      </section>

      <div className="analytics-primary-grid">
        <section className="panel analytics-funnel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CONVERSIÓN</p>
              <h2>Embudo de asistencia</h2>
              <p>Del registro inicial a la asistencia confirmada.</p>
            </div>
            <span>{confirmedRate}% confirmado</span>
          </div>
          <div className="analytics-funnel">
            {funnel.map((step) => {
              const percentage = registration.total
                ? Math.round((step.value / registration.total) * 100)
                : 0;
              return (
                <div key={step.label}>
                  <p>
                    <span>{step.label}</span>
                    <b>{step.value.toLocaleString("es-CO")} · {percentage}%</b>
                  </p>
                  <div>
                    <span style={{ width: `${Math.min(100, percentage)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="analytics-footnote">
            La asistencia se actualizará cuando el participante ingrese al evento
            en vivo y su registro cambie a asistido.
          </p>
        </section>

        <section className="panel analytics-engagement-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">INTERACCIÓN</p>
              <h2>Participación de la audiencia</h2>
              <p>Preguntas y votaciones registradas localmente.</p>
            </div>
          </div>
          <div className="analytics-engagement-body">
            <div
              className="analytics-ring"
              role="img"
              aria-label={`${interaction.participationRate}% de participación`}
              style={{
                background: `conic-gradient(#6946df ${Math.min(100, interaction.participationRate) * 3.6}deg, #ece9f3 0deg)`,
              }}
            >
              <div>
                <strong>{interaction.participationRate}%</strong>
                <small>participación</small>
              </div>
            </div>
            <div className="analytics-engagement-stats">
              <div><span>?</span><p><b>{interaction.questions}</b><small>preguntas</small></p></div>
              <div><span>✓</span><p><b>{interaction.answeredQuestions}</b><small>respondidas</small></p></div>
              <div><span>▥</span><p><b>{interaction.polls}</b><small>encuestas</small></p></div>
              <div><span>●</span><p><b>{interaction.votes}</b><small>votos</small></p></div>
            </div>
          </div>
        </section>
      </div>

      <div className="analytics-secondary-grid">
        <section className="panel analytics-timeline-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CRECIMIENTO</p>
              <h2>Registros por día</h2>
              <p>Últimos {Math.max(1, timeline.length)} días con actividad.</p>
            </div>
          </div>
          {timeline.length ? (
            <div className="analytics-timeline">
              {timeline.map((point) => (
                <div key={point.date}>
                  <b>{point.total}</b>
                  <div>
                    <span
                      style={{
                        height: `${Math.max(12, (point.total / timelineMaximum) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>{formatTimelineDate(point.date)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="analytics-inline-empty">Aún no hay registros para graficar.</p>
          )}
        </section>

        <section className="panel analytics-operations-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">OPERACIÓN</p>
              <h2>Comunicaciones y streaming</h2>
              <p>Preparación para la ejecución del evento.</p>
            </div>
          </div>
          <div className="analytics-operation-list">
            <div>
              <span className="queued" />
              <p><b>{communications.queued} en cola</b><small>Confirmaciones listas para proveedor</small></p>
            </div>
            <div>
              <span className="scheduled" />
              <p><b>{communications.scheduled} programados</b><small>Recordatorios con fecha definida</small></p>
            </div>
            <div>
              <span className="sent" />
              <p><b>{communications.sent} enviados</b><small>Entregas completadas</small></p>
            </div>
            <div>
              <span className={streaming.live ? "live" : streaming.ready ? "ready" : "pending"} />
              <p>
                <b>
                  {streaming.live
                    ? `${streaming.live} sesión en vivo`
                    : streaming.ready
                      ? `${streaming.ready} sesión lista`
                      : "Streaming pendiente"}
                </b>
                <small>{streaming.sessions} sesiones configuradas en el evento</small>
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="panel analytics-polls-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ENCUESTAS</p>
            <h2>Resultados por pregunta</h2>
            <p>Distribución de votos capturados en la sala del participante.</p>
          </div>
        </div>
        {analytics.polls.length ? (
          <div className="analytics-poll-grid">
            {analytics.polls.map((poll) => (
              <article key={poll.id}>
                <header>
                  <span className={poll.status}>{pollStatusLabels[poll.status]}</span>
                  <small>{poll.totalVotes} votos</small>
                </header>
                <h3>{poll.question}</h3>
                <div>
                  {poll.options.map((option) => (
                    <div key={option.id}>
                      <p><span>{option.label}</span><b>{option.votes} · {option.percentage}%</b></p>
                      <div><span style={{ width: `${option.percentage}%` }} /></div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="analytics-inline-empty">Crea una encuesta para empezar a medir respuestas.</p>
        )}
      </section>
    </div>
  );
}
