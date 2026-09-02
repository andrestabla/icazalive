"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

type ScheduleConflict = {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  reasons: ("organizer" | "zoom_license")[];
};

type EventRecord = {
  id: string;
  title: string;
  slug: string;
  format: "live" | "simulated" | "hybrid";
  status: string;
  startsAt: string;
  endsAt: string;
  maxAttendees: number;
  registrationOpen: boolean;
  conflicts: ScheduleConflict[];
};

const formatLabels = {
  live: "En vivo",
  simulated: "Simulado",
  hybrid: "Híbrido",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  registration_open: "Registro abierto",
  preparing: "En preparación",
  live: "En vivo",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: PLATFORM_TIMEZONE,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateKey(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function conflictLabel(conflict: ScheduleConflict) {
  if (
    conflict.reasons.includes("organizer") &&
    conflict.reasons.includes("zoom_license")
  ) {
    return "Organizador y Zoom";
  }
  return conflict.reasons.includes("zoom_license")
    ? "Licencia Zoom"
    : "Organizador";
}

export default function EventsList() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"catalog" | "calendar">("catalog");
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [loading, setLoading] = useState(true);
  const [duplicateSource, setDuplicateSource] =
    useState<EventRecord | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [duplicateStartsAt, setDuplicateStartsAt] = useState("");
  const [duplicateConflicts, setDuplicateConflicts] = useState<
    ScheduleConflict[]
  >([]);
  const [duplicateError, setDuplicateError] = useState("");
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    slug: string;
  } | null>(null);

  const loadEvents = async () => {
    const response = await fetch("/api/events", { cache: "no-store" });
    const payload = (await response.json()) as {
      data?: EventRecord[];
      error?: string;
    };
    if (response.ok && payload.data) setEvents(payload.data);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/events", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: EventRecord[];
        };
        if (!cancelled && response.ok && payload.data) {
          setEvents(payload.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return events.filter((event) => {
      const matchesSearch =
        !term || event.title.toLocaleLowerCase("es").includes(term);
      const matchesStatus = status === "all" || event.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [events, search, status]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth(),
      1,
    );
    const mondayIndex = (firstDay.getDay() + 6) % 7;
    const calendarStart = new Date(firstDay);
    calendarStart.setDate(firstDay.getDate() - mondayIndex);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + index);
      return date;
    });
  }, [monthCursor]);

  const openDuplicate = (event: EventRecord) => {
    const suggested = new Date(
      new Date(event.startsAt).getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    setDuplicateSource(event);
    setDuplicateTitle(`${event.title} — copia`);
    setDuplicateStartsAt(toLocalDateTimeInput(suggested.toISOString()));
    setDuplicateConflicts([]);
    setDuplicateError("");
  };

  const duplicateEvent = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!duplicateSource) return;
    setDuplicateSaving(true);
    setDuplicateError("");
    const startsAt = new Date(duplicateStartsAt);
    const response = await fetch(
      `/api/events/${duplicateSource.slug}/duplicate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: duplicateTitle,
          startsAt: startsAt.toISOString(),
          allowConflict: duplicateConflicts.length > 0,
        }),
      },
    );
    const payload = (await response.json()) as {
      data?: EventRecord;
      error?: string;
      conflicts?: ScheduleConflict[];
      requiresConfirmation?: boolean;
    };
    if (!response.ok || !payload.data) {
      if (payload.requiresConfirmation && payload.conflicts?.length) {
        setDuplicateConflicts(payload.conflicts);
        setDuplicateError(
          "El nuevo horario se solapa. Confirma nuevamente para duplicar de todas formas.",
        );
      } else {
        setDuplicateError(payload.error ?? "No fue posible duplicar el evento.");
      }
      setDuplicateSaving(false);
      return;
    }
    await loadEvents();
    setNotice({
      text: `“${payload.data.title}” quedó creado como borrador.`,
      slug: payload.data.slug,
    });
    setDuplicateSource(null);
    setDuplicateConflicts([]);
    setDuplicateSaving(false);
  };

  const monthLabel = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric", timeZone: PLATFORM_TIMEZONE }).format(monthCursor);

  return (
    <>
      <header className="module-header">
        <div>
          <p className="eyebrow">GESTIÓN</p>
          <h1>Eventos</h1>
          <p>Crea, programa y supervisa todas tus experiencias.</p>
        </div>
        <Link href="/" className="primary-button link-button">＋ Crear evento</Link>
      </header>

      {notice && (
        <div className="events-notice" role="status">
          <span>✓</span>
          <p>{notice.text}</p>
          <Link href={`/events/${notice.slug}`}>Configurar evento →</Link>
          <button aria-label="Cerrar aviso" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <section className="panel filter-panel event-filter-panel">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre del evento"
            aria-label="Buscar eventos"
          />
        </label>
        <label className="filter-select">
          <span>Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Todos</option>
            <option value="draft">Borrador</option>
            <option value="registration_open">Registro abierto</option>
            <option value="preparing">En preparación</option>
            <option value="live">En vivo</option>
            <option value="completed">Finalizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <div className="event-view-switch" aria-label="Vista de eventos">
          <button
            className={view === "catalog" ? "active" : ""}
            onClick={() => setView("catalog")}
          >
            ☷ Lista
          </button>
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => setView("calendar")}
          >
            ◫ Calendario
          </button>
        </div>
        <div className="result-count"><b>{filteredEvents.length}</b> eventos</div>
      </section>

      {loading ? (
        <div className="module-empty">Cargando eventos…</div>
      ) : filteredEvents.length === 0 ? (
        <div className="module-empty">
          <span>⌕</span>
          <h2>No encontramos eventos</h2>
          <p>Prueba con otro nombre o cambia el filtro seleccionado.</p>
        </div>
      ) : view === "catalog" ? (
        <section className="events-catalog">
          {filteredEvents.map((event) => {
            const start = new Date(event.startsAt);
            const end = new Date(event.endsAt);
            const day = new Intl.DateTimeFormat("es-CO", {
              day: "2-digit",
              timeZone: PLATFORM_TIMEZONE,
            }).format(start);
            const month = new Intl.DateTimeFormat("es-CO", {
              month: "short",
              timeZone: PLATFORM_TIMEZONE,
            }).format(start).replace(".", "").toUpperCase();

            return (
              <article className="catalog-card" key={event.id}>
                <div className={`catalog-accent ${event.format}`} />
                <div className="catalog-date"><b>{day}</b><span>{month}</span></div>
                <div className="catalog-main">
                  <div className="catalog-badges">
                    <span className={`format-badge ${event.format}`}>{formatLabels[event.format]}</span>
                    <span className={`status plain ${event.status}`}>● {statusLabels[event.status]}</span>
                    {event.conflicts.length > 0 && (
                      <span className="conflict-badge" title={event.conflicts.map((conflict) => conflict.title).join(", ")}>
                        ⚠ {event.conflicts.length} conflicto{event.conflicts.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <h2>{event.title}</h2>
                  <div className="catalog-meta">
                    <span>◷ {new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: PLATFORM_TIMEZONE }).format(start)}</span>
                    <span>Duración {Math.round((end.getTime() - start.getTime()) / 60000)} min</span>
                    <span>Hasta {event.maxAttendees.toLocaleString("es-CO")} asistentes</span>
                  </div>
                </div>
                <div className="catalog-registration">
                  <small>REGISTRO</small>
                  <b className={event.registrationOpen ? "open" : ""}>{event.registrationOpen ? "Abierto" : "Cerrado"}</b>
                </div>
                <div className="catalog-actions">
                  <button onClick={() => openDuplicate(event)}>Duplicar</button>
                  <Link href={`/events/${event.slug}`} className="detail-link">Gestionar <span>→</span></Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel event-calendar">
          <header>
            <div>
              <p className="eyebrow">PLANIFICACIÓN</p>
              <h2>{monthLabel}</h2>
            </div>
            <div>
              <button
                onClick={() =>
                  setMonthCursor(
                    new Date(
                      monthCursor.getFullYear(),
                      monthCursor.getMonth() - 1,
                      1,
                    ),
                  )
                }
                aria-label="Mes anterior"
              >
                ←
              </button>
              <button
                onClick={() =>
                  setMonthCursor(
                    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                  )
                }
              >
                Hoy
              </button>
              <button
                onClick={() =>
                  setMonthCursor(
                    new Date(
                      monthCursor.getFullYear(),
                      monthCursor.getMonth() + 1,
                      1,
                    ),
                  )
                }
                aria-label="Mes siguiente"
              >
                →
              </button>
            </div>
          </header>
          <div className="calendar-weekdays">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((date) => {
              const key = dateKey(date);
              const dayEvents = filteredEvents.filter(
                (event) => eventDateKey(event.startsAt) === key,
              );
              const outside = date.getMonth() !== monthCursor.getMonth();
              const today = dateKey(new Date()) === key;
              return (
                <article className={`${outside ? "outside" : ""} ${today ? "today" : ""}`} key={key}>
                  <b>{date.getDate()}</b>
                  <div>
                    {dayEvents.map((event) => (
                      <Link
                        className={`${event.format} ${event.conflicts.length ? "conflict" : ""}`}
                        href={`/events/${event.slug}`}
                        key={event.id}
                        title={
                          event.conflicts.length
                            ? `${event.title} · ${event.conflicts.map(conflictLabel).join(", ")}`
                            : event.title
                        }
                      >
                        <small>
                          {new Intl.DateTimeFormat("es-CO", {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: PLATFORM_TIMEZONE,
                          }).format(new Date(event.startsAt))}
                        </small>
                        <span>{event.title}</span>
                        {event.conflicts.length > 0 && <i>⚠</i>}
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
          <footer>
            <span><i className="live" /> En vivo</span>
            <span><i className="hybrid" /> Híbrido</span>
            <span><i className="simulated" /> Simulado</span>
            <b>⚠ indica solapamiento de organizador o licencia Zoom</b>
          </footer>
        </section>
      )}

      {duplicateSource && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal duplicate-event-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setDuplicateSource(null)}>×</button>
            <span className="modal-icon">⧉</span>
            <p className="eyebrow">DUPLICAR EVENTO</p>
            <h2 id="duplicate-title">Crear desde “{duplicateSource.title}”</h2>
            <p>Se copiarán agenda, comunicaciones, encuestas, recursos y configuración técnica segura. Los datos de participantes no se duplican.</p>
            <form className="event-form" onSubmit={duplicateEvent}>
              <label>
                Nombre del nuevo evento
                <input
                  required
                  minLength={3}
                  maxLength={180}
                  value={duplicateTitle}
                  onChange={(input) => setDuplicateTitle(input.target.value)}
                />
              </label>
              <label>
                Nueva fecha y hora
                <input
                  required
                  type="datetime-local"
                  value={duplicateStartsAt}
                  onChange={(input) => {
                    setDuplicateStartsAt(input.target.value);
                    setDuplicateConflicts([]);
                    setDuplicateError("");
                  }}
                />
              </label>
              {duplicateError && <p className="form-error" role="alert">{duplicateError}</p>}
              {duplicateConflicts.length > 0 && (
                <div className="schedule-conflict-list">
                  <b>Coincidencias detectadas</b>
                  {duplicateConflicts.map((conflict) => (
                    <p key={conflict.id}>
                      <span>{conflict.title}</span>
                      <small>{conflictLabel(conflict)} · {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: PLATFORM_TIMEZONE }).format(new Date(conflict.startsAt))}</small>
                    </p>
                  ))}
                </div>
              )}
              <div className="duplicate-modal-actions">
                <button type="button" onClick={() => setDuplicateSource(null)}>Cancelar</button>
                <button className="primary-button" disabled={duplicateSaving}>
                  {duplicateSaving
                    ? "Duplicando…"
                    : duplicateConflicts.length
                      ? "Duplicar de todas formas"
                      : "Duplicar como borrador"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
