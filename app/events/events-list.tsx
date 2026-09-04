"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import "./events-actions.css";
import { useEffect, useMemo, useState } from "react";
import { PLATFORM_TIMEZONE, platformLocalToDate, toPlatformDateTimeInput } from "@/lib/timezone";

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
  return toPlatformDateTimeInput(value);
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState("");
  const [actionsMenu, setActionsMenu] = useState<{
    event: EventRecord;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!actionsMenu) return;
    const close = () => setActionsMenu(null);
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [actionsMenu]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { role?: string } } | null) => {
        if (!cancelled) setIsAdmin(payload?.data?.role === "administrator");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const deleteEvent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const response = await fetch(`/api/events/${deleteTarget.slug}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setDeleteError(payload.error ?? "No fue posible eliminar el evento.");
      setDeleting(false);
      return;
    }
    setEvents((current) => current.filter((item) => item.id !== deleteTarget.id));
    setDeleteNotice(`Evento “${deleteTarget.title}” eliminado. Queda registrado en Auditoría.`);
    setDeleteTarget(null);
    setDeleteConfirmation("");
    setDeleting(false);
  };
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
    const startsAt = platformLocalToDate(duplicateStartsAt);
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
      {deleteNotice && (
        <div className="events-notice" role="status">
          <span>✓</span>
          <p>{deleteNotice}</p>
          <button aria-label="Cerrar aviso" onClick={() => setDeleteNotice("")}>×</button>
        </div>
      )}

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
                  <button
                    type="button"
                    className="event-actions-trigger"
                    aria-haspopup="menu"
                    aria-expanded={actionsMenu?.event.id === event.id}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      const bounds = clickEvent.currentTarget.getBoundingClientRect();
                      setActionsMenu((current) =>
                        current?.event.id === event.id
                          ? null
                          : { event, x: bounds.right, y: bounds.bottom + 6 },
                      );
                    }}
                  >
                    Acciones <span aria-hidden="true">▾</span>
                  </button>
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
      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal duplicate-event-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setDeleteTarget(null)}>×</button>
            <span className="modal-icon danger">×</span>
            <p className="eyebrow">ELIMINAR EVENTO</p>
            <h2 id="delete-title">Eliminar “{deleteTarget.title}”</h2>
            <p>
              Se borrarán de forma definitiva sus sesiones, inscripciones, comunicaciones,
              chat, preguntas, encuestas y recursos. Si tiene reunión de Zoom, se marcará
              como cancelada. La eliminación queda registrada en Auditoría.
            </p>
            <form
              className="event-form"
              onSubmit={(formEvent) => {
                formEvent.preventDefault();
                void deleteEvent();
              }}
            >
              <label>
                Escribe ELIMINAR para confirmar
                <input
                  required
                  autoComplete="off"
                  value={deleteConfirmation}
                  onChange={(input) => setDeleteConfirmation(input.target.value)}
                  placeholder="ELIMINAR"
                />
              </label>
              {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
              <div className="duplicate-modal-actions">
                <button type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button>
                <button className="primary-button" disabled={deleting || deleteConfirmation.trim().toUpperCase() !== "ELIMINAR"}>
                  {deleting ? "Eliminando…" : "Eliminar definitivamente"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {actionsMenu && (
        <div
          className="event-actions-menu"
          role="menu"
          style={{ left: actionsMenu.x, top: actionsMenu.y }}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              openDuplicate(actionsMenu.event);
              setActionsMenu(null);
            }}
          >
            Duplicar
          </button>
          {isAdmin && (
            <>
              <div className="event-actions-separator" />
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setDeleteTarget(actionsMenu.event);
                  setDeleteConfirmation("");
                  setDeleteError("");
                  setActionsMenu(null);
                }}
              >
                Eliminar
              </button>
              <div className="event-actions-separator" />
            </>
          )}
          <Link role="menuitem" href={`/events/${actionsMenu.event.slug}`}>
            Gestionar →
          </Link>
        </div>
      )}
    </>
  );
}
