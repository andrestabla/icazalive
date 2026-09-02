"use client";

type EventTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  format: string;
  durationMinutes: number;
};

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import AdminSidebar from "@/app/components/admin-sidebar";
import type { AuthenticatedUser } from "@/lib/auth";
import type { DashboardSummary } from "@/lib/dashboard";
import { PLATFORM_TIMEZONE, platformLocalToDate, toPlatformDateTimeInput } from "@/lib/timezone";

type EventFormat = "live" | "simulated" | "hybrid";
type ScheduleConflict = {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  reasons: ("organizer" | "zoom_license")[];
};

const typeByFormat: Record<EventFormat, string> = {
  live: "Webinar en vivo",
  hybrid: "Evento híbrido",
  simulated: "Simulado",
};

const toneByFormat: Record<EventFormat, string> = {
  live: "violet",
  hybrid: "mint",
  simulated: "amber",
};

const statusLabels: Record<
  DashboardSummary["events"][number]["status"],
  string
> = {
  draft: "Borrador",
  registration_open: "Registro abierto",
  preparing: "En preparación",
  live: "En vivo",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

function datePart(
  value: string,
  options: Intl.DateTimeFormatOptions,
  type: Intl.DateTimeFormatPartTypes,
) {
  return (
    new Intl.DateTimeFormat("es-CO", {
      ...options,
      timeZone: PLATFORM_TIMEZONE,
    })
      .formatToParts(new Date(value))
      .find((part) => part.type === type)
      ?.value.replace(/\s+/g, " ") ?? ""
  );
}

function dashboardDate(value: string) {
  return {
    day: datePart(value, { day: "2-digit" }, "day"),
    month: datePart(value, { month: "short" }, "month")
      .replace(".", "")
      .toUpperCase(),
    time: `${datePart(
      value,
      { hour: "numeric", minute: "2-digit", hour12: true },
      "hour",
    )}:${datePart(
      value,
      { hour: "numeric", minute: "2-digit", hour12: true },
      "minute",
    )} ${datePart(
      value,
      { hour: "numeric", minute: "2-digit", hour12: true },
      "dayPeriod",
    )}`.trim(),
  };
}

function topDate(value: string) {
  const weekday = datePart(value, { weekday: "long" }, "weekday");
  const day = datePart(value, { day: "numeric" }, "day");
  const month = datePart(value, { month: "long" }, "month");
  return `${weekday}, ${day} de ${month}`.toLocaleUpperCase("es-CO");
}

function greeting(value: string) {
  const hour = Number(
    datePart(value, { hour: "numeric", hourCycle: "h23" }, "hour"),
  );
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function relativeTime(value: string, reference: string) {
  const difference = Math.max(
    0,
    new Date(reference).getTime() - new Date(value).getTime(),
  );
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Ayer" : `Hace ${days} días`;
}

export default function Dashboard({
  user,
  initialData,
  granted,
}: {
  user: AuthenticatedUser;
  initialData: DashboardSummary;
  granted: string[];
}) {
  const [data, setData] = useState(initialData);
  const [showCreate, setShowCreate] = useState(false);
  const [templates, setTemplates] = useState<EventTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<EventFormat | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [formError, setFormError] = useState("");
  const [scheduleConflicts, setScheduleConflicts] = useState<
    ScheduleConflict[]
  >([]);
  const [notice, setNotice] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const firstName = user.name.split(/\s+/)[0];

  const loadDashboard = async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const payload = (await response.json()) as {
      data?: DashboardSummary;
      error?: string;
    };
    if (response.ok && payload.data) {
      setData(payload.data);
      return true;
    }
    setNotice(payload.error ?? "No fue posible actualizar el resumen.");
    return false;
  };

  const openCreate = () => {
    setSelectedFormat(null);
    setFormError("");
    setScheduleConflicts([]);
    setShowCreate(true);
    fetch("/api/event-templates")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: EventTemplateSummary[] } | null) => {
        if (payload?.data) setTemplates(payload.data);
      })
      .catch(() => undefined);
  };

  const createEvent = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!selectedFormat) return;
    setSavingEvent(true);
    setFormError("");

    const form = new FormData(formEvent.currentTarget);
    const startsAt = platformLocalToDate(String(form.get("startsAt")));
    const duration = Number(form.get("duration"));
    if (Number.isNaN(startsAt.getTime()) || !duration) {
      setFormError("Selecciona una fecha, hora y duración válidas.");
      setSavingEvent(false);
      return;
    }
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        format: selectedFormat,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        allowConflict: scheduleConflicts.length > 0,
        templateId: selectedTemplateId || undefined,
      }),
    });
    const payload = (await response.json()) as {
      data?: { slug: string };
      error?: string;
      conflicts?: ScheduleConflict[];
      requiresConfirmation?: boolean;
    };

    if (!response.ok || !payload.data) {
      if (payload.requiresConfirmation && payload.conflicts?.length) {
        setScheduleConflicts(payload.conflicts);
        setFormError(
          "Detectamos un solapamiento. Revisa el detalle y confirma si deseas crear el borrador de todas formas.",
        );
        setSavingEvent(false);
        return;
      }
      setFormError(payload.error ?? "No fue posible crear el evento.");
      setSavingEvent(false);
      return;
    }

    await loadDashboard();
    setSavingEvent(false);
    setShowCreate(false);
    setScheduleConflicts([]);
    setNotice("Evento creado y reflejado en el resumen operativo.");
  };

  const zoom = data.integrations.find(
    (integration) => integration.provider === "zoom",
  );
  const ivs = data.integrations.find(
    (integration) => integration.provider === "amazon_ivs",
  );
  const integrationLabel = (
    integration: DashboardSummary["integrations"][number] | undefined,
  ) => {
    if (!integration || integration.status === "disconnected")
      return "Sin conectar";
    if (integration.status === "pending") return "Pendiente";
    if (integration.status === "configured") return "Configurado";
    if (integration.status === "connected") return "Conectado";
    return "Con error";
  };
  const visibleActivity = showAllActivity
    ? data.activity
    : data.activity.slice(0, 3);

  return (
    <main className="app-shell">
      <AdminSidebar user={user} granted={granted} active="Resumen" />

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{topDate(data.generatedAt)}</p>
            <h1>
              {greeting(data.generatedAt)}, {firstName}
            </h1>
            <p>Este es el estado real de tus eventos y operaciones locales.</p>
          </div>
          <div className="top-actions">
            <div className="notification-control">
              <button
                className="icon-button"
                aria-label="Notificaciones"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                ♢
                {data.notificationCount > 0 && (
                  <span>
                    {data.notificationCount > 9
                      ? "9+"
                      : data.notificationCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <section
                  className="notification-popover"
                  aria-label="Alertas operativas"
                >
                  <header>
                    <div>
                      <p className="eyebrow">CENTRO OPERATIVO</p>
                      <h2>Notificaciones</h2>
                    </div>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      aria-label="Cerrar notificaciones"
                    >
                      ×
                    </button>
                  </header>
                  <div>
                    {data.notifications.length ? (
                      data.notifications.map((notification) => (
                        <Link
                          href={notification.href}
                          key={notification.id}
                          onClick={() => setNotificationsOpen(false)}
                        >
                          <span className={notification.tone}>
                            {notification.tone === "error"
                              ? "×"
                              : notification.tone === "warning"
                                ? "!"
                                : "i"}
                          </span>
                          <p>
                            <b>{notification.title}</b>
                            <small>{notification.detail}</small>
                          </p>
                          <i>→</i>
                        </Link>
                      ))
                    ) : (
                      <div className="notification-empty">
                        <span>✓</span>
                        <p>
                          <b>Todo bajo control</b>
                          <small>No hay alertas operativas pendientes.</small>
                        </p>
                      </div>
                    )}
                  </div>
                  <footer>
                    <Link href="/integrations">Revisar integraciones →</Link>
                  </footer>
                </section>
              )}
            </div>
            <button className="primary-button" onClick={openCreate}>
              <b>＋</b> Crear evento
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice" role="status">
            <span>ⓘ</span>
            {notice}
            <button onClick={() => setNotice("")} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}

        <section className="stat-grid" aria-label="Métricas principales">
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-icon purple">◫</span>
              <small>Base local</small>
            </div>
            <strong>{data.metrics.events}</strong>
            <p>Eventos totales</p>
            <span className="trend neutral">Actualizado</span>
          </article>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-icon blue">♙</span>
              <small>Registros activos</small>
            </div>
            <strong>{data.metrics.registrations.toLocaleString("es-CO")}</strong>
            <p>Personas registradas</p>
            <span className="trend neutral">Sin cancelados</span>
          </article>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-icon green">◎</span>
              <small>Confirmados</small>
            </div>
            <strong>
              {data.metrics.attendanceRate}
              <span>%</span>
            </strong>
            <p>Tasa de asistencia</p>
            <span className="trend neutral">Datos reales</span>
          </article>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-icon orange">⌁</span>
              <small>Interacción</small>
            </div>
            <strong>
              {data.metrics.participationRate}
              <span>%</span>
            </strong>
            <p>Participación de audiencia</p>
            <span className="trend neutral">Preguntas y votos</span>
          </article>
        </section>

        <div className="content-grid">
          <section className="panel events-panel">
            <div className="panel-heading">
              <div>
                <h2>Próximos eventos</h2>
                <p>Sesiones futuras ordenadas por fecha.</p>
              </div>
              <Link href="/events">
                Ver todos <span>→</span>
              </Link>
            </div>
            <div className="event-list">
              {data.events.length ? (
                data.events.map((event) => {
                  const date = dashboardDate(event.startsAt);
                  const tone = toneByFormat[event.format];
                  return (
                    <article className="event-row" key={event.id}>
                      <div className={`date-tile ${tone}`}>
                        <b>{date.day}</b>
                        <span>{date.month}</span>
                      </div>
                      <div className="event-info">
                        <h3>
                          <Link href={`/events/${event.slug}`}>
                            {event.title}
                          </Link>
                        </h3>
                        <p>
                          {typeByFormat[event.format]}
                          <i />
                          {date.time}
                        </p>
                      </div>
                      <div className="attendees">
                        <span>♙</span>
                        <div>
                          <b>{event.registrations.toLocaleString("es-CO")}</b>
                          <small>registrados</small>
                        </div>
                      </div>
                      <span className={`status ${tone}`}>
                        ● {statusLabels[event.status]}
                      </span>
                      <Link
                        className="more"
                        href={`/events/${event.slug}`}
                        aria-label={`Gestionar ${event.title}`}
                      >
                        •••
                      </Link>
                    </article>
                  );
                })
              ) : (
                <div className="dashboard-empty">
                  No hay eventos futuros. Crea uno para comenzar.
                </div>
              )}
            </div>
          </section>

          <aside className="panel integration-panel">
            <div className="panel-heading">
              <div>
                <h2>Integraciones</h2>
                <p>Estado actual de servicios clave.</p>
              </div>
            </div>
            <div className="integration">
              <div className="service-logo zoom">zoom</div>
              <div>
                <h3>Zoom</h3>
                <p>{zoom?.accountLabel ?? "Webinars y Meetings"}</p>
              </div>
              <span className={`connection ${zoom?.status ?? "disconnected"}`}>
                {integrationLabel(zoom)}
              </span>
            </div>
            <div className="integration">
              <div className="service-logo aws">aws</div>
              <div>
                <h3>Amazon IVS</h3>
                <p>{ivs?.accountLabel ?? "Streaming de baja latencia"}</p>
              </div>
              <span className={`connection ${ivs?.status ?? "disconnected"}`}>
                {integrationLabel(ivs)}
              </span>
            </div>
            <Link
              className="secondary-button dashboard-integration-link"
              href="/integrations"
            >
              Configurar integraciones
            </Link>
            <p className="safe-note">
              ⌁ Las claves privadas permanecen en el servidor.
            </p>
          </aside>
        </div>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p>Movimientos derivados de los datos locales.</p>
            </div>
            {data.activity.length > 3 && (
              <button
                onClick={() => setShowAllActivity((expanded) => !expanded)}
              >
                {showAllActivity ? "Ver menos" : "Ver historial"}{" "}
                <span>{showAllActivity ? "↑" : "→"}</span>
              </button>
            )}
          </div>
          {visibleActivity.length ? (
            <div className="activity-list">
              {visibleActivity.map((item) => (
                <Link className="activity-row" href={item.href} key={item.id}>
                  <div className="avatar soft">{item.initials}</div>
                  <div>
                    <b>{item.action}</b>
                    <p>{item.subject}</p>
                  </div>
                  <time>
                    {relativeTime(item.occurredAt, data.generatedAt)}
                  </time>
                </Link>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              La actividad aparecerá cuando el equipo comience a trabajar.
            </div>
          )}
        </section>
      </section>

      {showCreate && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!savingEvent) setShowCreate(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              disabled={savingEvent}
              onClick={() => setShowCreate(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <span className="modal-icon">✦</span>
            <p className="eyebrow">NUEVO EVENTO</p>
            {!selectedFormat ? (
              <>
                <h2 id="create-title">¿Qué quieres organizar?</h2>
                <p>Elige el formato del evento para comenzar.</p>
                <div className="event-options">
                  {[
                    [
                      "●",
                      "En vivo",
                      "Zoom + interacción en tiempo real",
                      "live",
                    ],
                    [
                      "▷",
                      "Simulado",
                      "Video pregrabado con experiencia live",
                      "simulated",
                    ],
                    [
                      "◇",
                      "Híbrido",
                      "Audiencia presencial y remota",
                      "hybrid",
                    ],
                  ].map(([icon, title, text, format]) => (
                    <button
                      key={title}
                      onClick={() =>
                        setSelectedFormat(format as EventFormat)
                      }
                    >
                      <span>{icon}</span>
                      <div>
                        <b>{title}</b>
                        <small>{text}</small>
                      </div>
                      <i>→</i>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  className="back-button"
                  onClick={() => setSelectedFormat(null)}
                >
                  ← Cambiar formato
                </button>
                <h2 id="create-title">Información principal</h2>
                <p>
                  Crearemos el evento como borrador. Las integraciones se
                  configuran después.
                </p>
                <form className="event-form" onSubmit={createEvent}>
                  {templates.length > 0 && (
                    <label>
                      Plantilla (opcional)
                      <select
                        value={selectedTemplateId}
                        onChange={(input) => setSelectedTemplateId(input.target.value)}
                      >
                        <option value="">Sin plantilla · configuración vacía</option>
                        {templates.map((template) => (
                          <option value={template.id} key={template.id}>
                            {template.name} · {template.durationMinutes} min
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Nombre del evento
                    <input
                      name="title"
                      required
                      minLength={3}
                      placeholder="Ej. Conversaciones que inspiran"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Fecha y hora <small>hora de Miami</small>
                      <input
                        name="startsAt"
                        type="datetime-local"
                        required
                        onChange={() => setScheduleConflicts([])}
                      />
                    </label>
                    <label>
                      Duración
                      <select
                        name="duration"
                        defaultValue="60"
                        onChange={() => setScheduleConflicts([])}
                      >
                        <option value="30">30 minutos</option>
                        <option value="60">1 hora</option>
                        <option value="90">1 h 30 min</option>
                        <option value="120">2 horas</option>
                      </select>
                    </label>
                  </div>
                  {formError && (
                    <p className="form-error" role="alert">
                      {formError}
                    </p>
                  )}
                  {scheduleConflicts.length > 0 && (
                    <div className="schedule-conflict-list" role="alert">
                      <b>Conflicto de programación</b>
                      {scheduleConflicts.map((conflict) => (
                        <p key={conflict.id}>
                          <span>{conflict.title}</span>
                          <small>
                            {conflict.reasons.includes("zoom_license")
                              ? "Licencia Zoom"
                              : "Organizador"}{" "}
                            ·{" "}
                            {new Intl.DateTimeFormat("es-CO", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: PLATFORM_TIMEZONE,
                            }).format(new Date(conflict.startsAt))}
                          </small>
                        </p>
                      ))}
                    </div>
                  )}
                  <button
                    className="primary-button submit-button"
                    disabled={savingEvent}
                  >
                    {savingEvent
                      ? "Guardando…"
                      : scheduleConflicts.length
                        ? "Crear a pesar del conflicto"
                        : "Crear borrador"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
