"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { downloadXlsx } from "@/lib/xlsx-export";
import ParticipantInviter from "./participant-inviter";
import { useFeedbackSetter } from "@/lib/feedback";

type RegistrationStatus =
  | "registered"
  | "confirmed"
  | "attended"
  | "absent"
  | "cancelled";

type ParticipantRecord = {
  id: string;
  participantId: string;
  name: string;
  email: string;
  company: string | null;
  jobTitle: string | null;
  phone: string | null;
  marketingConsent: boolean;
  status: RegistrationStatus;
  source: string;
  joinedAt: string | null;
  leftAt: string | null;
  engagementScore: string | null;
  registeredAt: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  customFields: { id: string; label: string; value: string }[];
};

const statusLabels: Record<RegistrationStatus, string> = {
  registered: "Registrado",
  confirmed: "Confirmado",
  attended: "Asistió",
  absent: "No asistió",
  cancelled: "Cancelado",
};

const sourceLabels: Record<string, string> = {
  registration_page: "Página pública",
  manual: "Registro manual",
  import: "Importación",
};

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function csvCell(value: string | number | boolean | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

const PAGE_SIZE = 25;

// Vista agrupada: una fila por persona (el correo es su identificador) con el
// historial de todos los eventos en los que se ha inscrito.
type ParticipantGroup = {
  email: string;
  name: string;
  company: string | null;
  jobTitle: string | null;
  phone: string | null;
  records: ParticipantRecord[];
  lastRegisteredAt: string;
};

function groupByEmail(records: ParticipantRecord[]): ParticipantGroup[] {
  const groups = new Map<string, ParticipantGroup>();
  for (const record of records) {
    const key = record.email.toLowerCase();
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        email: record.email,
        name: record.name,
        company: record.company,
        jobTitle: record.jobTitle,
        phone: record.phone,
        records: [record],
        lastRegisteredAt: record.registeredAt,
      });
      continue;
    }
    group.records.push(record);
    if (record.registeredAt > group.lastRegisteredAt) {
      group.lastRegisteredAt = record.registeredAt;
      group.name = record.name;
    }
    group.company ??= record.company;
    group.jobTitle ??= record.jobTitle;
    group.phone ??= record.phone;
  }
  return Array.from(groups.values()).sort((a, b) =>
    b.lastRegisteredAt.localeCompare(a.lastRegisteredAt),
  );
}

type ExportColumn = {
  key: string;
  label: string;
  value: (
    record: ParticipantRecord,
    helpers: { timezone: string },
  ) => string | number;
};

const exportColumns: ExportColumn[] = [
  { key: "name", label: "Nombre", value: (record) => record.name },
  { key: "email", label: "Correo", value: (record) => record.email },
  { key: "phone", label: "Teléfono", value: (record) => record.phone ?? "" },
  { key: "company", label: "Empresa", value: (record) => record.company ?? "" },
  { key: "jobTitle", label: "Cargo", value: (record) => record.jobTitle ?? "" },
  { key: "event", label: "Evento", value: (record) => record.eventTitle },
  { key: "status", label: "Estado", value: (record) => statusLabels[record.status] },
  {
    key: "source",
    label: "Origen",
    value: (record) => sourceLabels[record.source] ?? record.source,
  },
  {
    key: "registeredAt",
    label: "Fecha de registro",
    value: (record, helpers) => formatDate(record.registeredAt, helpers.timezone),
  },
  {
    key: "marketingConsent",
    label: "Consentimiento de marketing",
    value: (record) => (record.marketingConsent ? "Sí" : "No"),
  },
  {
    key: "engagementScore",
    label: "Puntaje de interacción",
    value: (record) => record.engagementScore ?? "",
  },
];

export default function ParticipantsList() {
  const userTimezone = useUserTimezone();
  const [records, setRecords] = useState<ParticipantRecord[]>([]);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RegistrationStatus>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ParticipantRecord | null>(null);
  const [historyEmail, setHistoryEmail] = useState<string | null>(null);
  // Solo el administrador puede eliminar participantes de forma definitiva.
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const deleteParticipant = async (participantId: string, name: string, email: string) => {
    if (!window.confirm(`¿Eliminar definitivamente a ${name} (${email})?\n\nSe borrarán sus inscripciones en todos los eventos, sus accesos y los correos pendientes. Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setError("");
    const response = await fetch(`/api/participants/${participantId}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      setRecords((items) => items.filter((item) => item.participantId !== participantId));
      setHistoryEmail(null);
      setMessage(`Participante eliminado: ${name}.`);
    } else {
      setError(payload.error ?? "No fue posible eliminar el participante.");
    }
    setDeleting(false);
  };
  const [saving, setSaving] = useState(false);
  const [message, setMessageState] = useState("");
  const setMessage = useFeedbackSetter(setMessageState);
  const [error, setErrorState] = useState("");
  const setError = useFeedbackSetter(setErrorState, "error");
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  // Selección múltiple y envío manual de mensajes.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageMode, setMessageMode] = useState<"template" | "custom">("template");
  const [messageTemplate, setMessageTemplate] = useState<string>("reminder_1h");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const templateOptions: { value: string; label: string }[] = [
    { value: "registration_confirmation", label: "Confirmación de registro" },
    { value: "reminder_24h", label: "Recordatorio de 24 horas" },
    { value: "reminder_1h", label: "Recordatorio de 1 hora" },
    { value: "live_now", label: "Ya estamos en vivo" },
    { value: "post_event", label: "Seguimiento posterior" },
  ];
  const toggleSelected = (ids: string[], on: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const sendManualMessage = async () => {
    setSendingMessage(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/participants/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        messageMode === "template"
          ? { registrationIds: Array.from(selectedIds), templateType: messageTemplate }
          : { registrationIds: Array.from(selectedIds), subject: messageSubject, body: messageBody },
      ),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: { sent: number; failed: number; skipped: number; provider: string; errors: string[] };
      error?: string;
    };
    if (response.ok && payload.data) {
      setMessageOpen(false);
      setMessage(
        `Mensaje enviado a ${payload.data.sent} participante${payload.data.sent === 1 ? "" : "s"}` +
          (payload.data.failed ? `, ${payload.data.failed} con error` : "") +
          (payload.data.skipped ? `, ${payload.data.skipped} omitido${payload.data.skipped === 1 ? "" : "s"} (cancelados o inactivos)` : "") +
          ` (proveedor ${payload.data.provider}).` +
          (payload.data.errors.length ? ` ${payload.data.errors.join(" · ")}` : ""),
      );
    } else {
      setError(payload.error ?? "No fue posible enviar el mensaje.");
    }
    setSendingMessage(false);
  };
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(exportColumns.map((column) => column.key)),
  );
  const [includeCustomFields, setIncludeCustomFields] = useState(true);

  useEffect(() => {
    fetch("/api/participants")
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: ParticipantRecord[];
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(
            payload.error ?? "No fue posible cargar los participantes.",
          );
        }
        setRecords(payload.data);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar los participantes.",
        );
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const eventOptions = useMemo(
    () =>
      Array.from(
        new Map(records.map((record) => [record.eventId, record.eventTitle])),
      ),
    [records],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return records.filter((record) => {
      const haystack =
        `${record.name} ${record.email} ${record.company ?? ""} ${record.jobTitle ?? ""} ${record.customFields.map((field) => field.value).join(" ")}`.toLocaleLowerCase(
          "es",
        );
      return (
        (!term || haystack.includes(term)) &&
        (eventFilter === "all" || record.eventId === eventFilter) &&
        (statusFilter === "all" || record.status === statusFilter)
      );
    });
  }, [records, search, eventFilter, statusFilter]);

  // Sin filtros de evento ni estado, la tabla muestra personas (no registros).
  const grouped = eventFilter === "all" && statusFilter === "all";
  const groups = useMemo(() => groupByEmail(filtered), [filtered]);
  const uniqueParticipants = useMemo(
    () => new Set(records.map((record) => record.email.toLowerCase())).size,
    [records],
  );
  const listLength = grouped ? groups.length : filtered.length;
  const pageCount = Math.max(1, Math.ceil(listLength / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const paginatedGroups = groups.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const historyGroup = historyEmail
    ? groupByEmail(records).find((group) => group.email.toLowerCase() === historyEmail)
    : null;

  const runExport = (format: "csv" | "xlsx") => {
    if (!filtered.length) return;
    const activeColumns = exportColumns.filter((column) =>
      selectedColumns.has(column.key),
    );
    const customLabels = includeCustomFields
      ? Array.from(
          new Set(
            filtered.flatMap((record) =>
              record.customFields.map((field) => field.label),
            ),
          ),
        )
      : [];
    const rows: (string | number)[][] = [
      [...activeColumns.map((column) => column.label), ...customLabels],
      ...filtered.map((record) => [
        ...activeColumns.map((column) =>
          column.value(record, { timezone: userTimezone }),
        ),
        ...customLabels.map(
          (label) =>
            record.customFields.find((field) => field.label === label)?.value ??
            "",
        ),
      ]),
    ];
    const eventName =
      eventFilter === "all"
        ? "todos"
        : records.find((record) => record.eventId === eventFilter)?.eventSlug ??
          "evento";
    const filename = `participantes-${eventName}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "xlsx") {
      downloadXlsx(filename, "Participantes", rows);
    } else {
      const csv = rows
        .map((row) => row.map((cell) => csvCell(cell)).join(","))
        .join("\r\n");
      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    setExportOpen(false);
    setMessage(
      `${filtered.length} participante${filtered.length === 1 ? "" : "s"} exportado${filtered.length === 1 ? "" : "s"} en ${format.toUpperCase()}.`,
    );
  };

  const patchStatus = async (
    record: ParticipantRecord,
    status: RegistrationStatus,
  ) => {
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/participants", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: record.id, status }),
    });
    const payload = (await response.json()) as {
      data?: { id: string; status: RegistrationStatus };
      error?: string;
    };
    if (response.ok && payload.data) {
      const updated = { ...record, status: payload.data.status };
      setRecords((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelected((current) => (current ? updated : current));
      setMessage(`Estado de ${record.name} actualizado.`);
    } else {
      setError(payload.error ?? "No fue posible actualizar el estado.");
    }
    setSaving(false);
  };

  return (
    <>
      <header className="module-header">
        <div>
          <p className="eyebrow">AUDIENCIA</p>
          <h1>Participantes</h1>
          <p>Consulta registros y segmenta la audiencia de tus eventos.</p>
        </div>
        <div className="participant-header-actions">
          <button
            className="secondary-action participant-message-button"
            disabled={!selectedIds.size || loading}
            title={selectedIds.size ? "Enviar un correo a los seleccionados" : "Selecciona participantes en la lista"}
            onClick={() => setMessageOpen(true)}
          >
            ✉ Enviar mensaje{selectedIds.size ? ` (${selectedIds.size})` : ""}
          </button>
          <button
            className="secondary-action"
            disabled={!filtered.length || loading}
            onClick={() => setExportOpen(true)}
          >
            ↓ Exportar
          </button>
          <ParticipantInviter
            onImported={() => setRefreshKey((current) => current + 1)}
          />
        </div>
      </header>

      {message && (
        <div className="detail-message" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="participant-error" role="alert">
          ⓘ {error}
        </div>
      )}

      <section className="participant-stats">
        <article>
          <span className="stat-icon blue">♙</span>
          <div>
            <strong>{uniqueParticipants}</strong>
            <p>Participantes · {records.length} registro{records.length === 1 ? "" : "s"}</p>
          </div>
        </article>
        <article>
          <span className="stat-icon green">✓</span>
          <div>
            <strong>
              {records.filter((item) => item.status === "attended").length}
            </strong>
            <p>Asistieron</p>
          </div>
        </article>
        <article>
          <span className="stat-icon purple">◎</span>
          <div>
            <strong>{new Set(records.map((item) => item.eventId)).size}</strong>
            <p>Eventos con registros</p>
          </div>
        </article>
      </section>

      <section className="panel filter-panel">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Buscar nombre, correo, empresa o cargo"
            aria-label="Buscar participantes"
          />
        </label>
        <label className="filter-select">
          <span>Evento</span>
          <select
            value={eventFilter}
            onChange={(event) => { setEventFilter(event.target.value); setPage(1); }}
          >
            <option value="all">Todos los eventos</option>
            {eventOptions.map(([id, title]) => (
              <option value={id} key={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span>Estado</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "all" | RegistrationStatus);
              setPage(1);
            }}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="result-count">
          <b>{filtered.length}</b> resultados
        </div>
      </section>

      <section className="panel participants-table">
        <div className="participant-table-head">
          <span className="participant-select-cell">
            <input
              type="checkbox"
              aria-label="Seleccionar todos los participantes de la lista"
              title="Seleccionar todos"
              disabled={loading || !filtered.length}
              checked={filtered.length > 0 && filtered.every((record) => selectedIds.has(record.id))}
              onChange={(input) => toggleSelected(filtered.map((record) => record.id), input.target.checked)}
            />
          </span>
          <span>PARTICIPANTE</span>
          <span>EMPRESA / CARGO</span>
          <span>{grouped ? "EVENTOS" : "EVENTO"}</span>
          <span>{grouped ? "ÚLTIMO REGISTRO" : "REGISTRO"}</span>
          <span>{grouped ? "ESTADOS" : "ESTADO"}</span>
          <span>ACCIÓN</span>
        </div>
        {loading ? (
          <div className="table-empty">Cargando participantes…</div>
        ) : listLength === 0 ? (
          <div className="table-empty">
            No hay participantes para los filtros seleccionados.
          </div>
        ) : grouped ? (
          paginatedGroups.map((group) => (
            <div className="participant-row" key={group.email}>
              <span className="participant-select-cell">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar a ${group.name}`}
                  checked={group.records.every((record) => selectedIds.has(record.id))}
                  onChange={(input) => toggleSelected(group.records.map((record) => record.id), input.target.checked)}
                />
              </span>
              <div className="participant-person">
                <span>
                  {group.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <p>
                  <b>{group.name}</b>
                  <small>{group.email}</small>
                </p>
              </div>
              <div>
                <b>{group.company ?? "—"}</b>
                <small>{group.jobTitle ?? "Sin cargo"}</small>
              </div>
              <div className="participant-events-cell">
                <b>{group.records.length} evento{group.records.length === 1 ? "" : "s"}</b>
                <small>{group.records.slice(0, 2).map((record) => record.eventTitle).join(" · ")}{group.records.length > 2 ? " …" : ""}</small>
              </div>
              <time>{formatDate(group.lastRegisteredAt, userTimezone)}</time>
              <span className="participant-status-summary">
                {Array.from(new Set(group.records.map((record) => record.status))).map((status) => (
                  <i className={`participant-status ${status}`} key={status}>● {statusLabels[status]}</i>
                ))}
              </span>
              <button
                className="participant-manage"
                onClick={() => {
                  setError("");
                  setHistoryEmail(group.email.toLowerCase());
                }}
              >
                Ver historial
              </button>
            </div>
          ))
        ) : (
          paginated.map((record) => (
            <div className="participant-row" key={record.id}>
              <span className="participant-select-cell">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar a ${record.name}`}
                  checked={selectedIds.has(record.id)}
                  onChange={(input) => toggleSelected([record.id], input.target.checked)}
                />
              </span>
              <div className="participant-person">
                <span>
                  {record.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <p>
                  <b>{record.name}</b>
                  <small>{record.email}</small>
                </p>
              </div>
              <div>
                <b>{record.company ?? "—"}</b>
                <small>{record.jobTitle ?? "Sin cargo"}</small>
              </div>
              <Link href={`/events/${record.eventSlug}`}>
                {record.eventTitle}
              </Link>
              <time>{formatDate(record.registeredAt, userTimezone)}</time>
              <span className={`participant-status ${record.status}`}>
                ● {statusLabels[record.status]}
              </span>
              <button
                className="participant-manage"
                onClick={() => {
                  setError("");
                  setSelected(record);
                }}
              >
                Gestionar
              </button>
            </div>
          ))
        )}
        {!loading && listLength > PAGE_SIZE && (
          <footer className="participants-pagination">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              ← Anterior
            </button>
            <span>
              Página <b>{currentPage}</b> de {pageCount} · {listLength}{" "}
              {grouped ? "participantes" : "registros"}
            </span>
            <button
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente →
            </button>
          </footer>
        )}
      </section>

      {historyGroup && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!saving) setHistoryEmail(null);
          }}
        >
          <section
            className="modal participant-modal participant-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="participant-history-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              disabled={saving}
              onClick={() => setHistoryEmail(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <div className="participant-modal-head">
              <span>
                {historyGroup.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div>
                <p className="eyebrow">HISTORIAL DEL PARTICIPANTE</p>
                <h2 id="participant-history-title">{historyGroup.name}</h2>
                <a href={`mailto:${historyGroup.email}`}>{historyGroup.email}</a>
              </div>
            </div>
            <div className="participant-detail-grid">
              <div>
                <small>EMPRESA</small>
                <b>{historyGroup.company ?? "Sin empresa"}</b>
                <span>{historyGroup.jobTitle ?? "Sin cargo"}</span>
              </div>
              <div>
                <small>TELÉFONO</small>
                <b>{historyGroup.phone ?? "No registrado"}</b>
                <span>{historyGroup.records.length} inscripción{historyGroup.records.length === 1 ? "" : "es"}</span>
              </div>
            </div>
            <div className="participant-history">
              <p className="eyebrow">EVENTOS</p>
              {historyGroup.records.map((record) => (
                <article className="participant-history-row" key={record.id}>
                  <div>
                    <Link href={`/events/${record.eventSlug}`}>{record.eventTitle}</Link>
                    <small>
                      {formatDate(record.registeredAt, userTimezone)} · {sourceLabels[record.source] ?? record.source}
                      {record.company ? ` · ${record.company}` : ""}
                    </small>
                  </div>
                  <select
                    aria-label={`Estado en ${record.eventTitle}`}
                    value={record.status}
                    disabled={saving}
                    onChange={(input) =>
                      void patchStatus(record, input.target.value as RegistrationStatus)
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="participant-manage"
                    onClick={() => {
                      setError("");
                      setSelected(record);
                    }}
                  >
                    Ficha
                  </button>
                </article>
              ))}
            </div>
            {error && (
              <p className="form-error" role="alert">{error}</p>
            )}
            <div className="participant-modal-actions">
              {isAdmin ? (
                <button
                  className="participant-delete-button"
                  disabled={saving || deleting}
                  onClick={() => void deleteParticipant(historyGroup.records[0].participantId, historyGroup.name, historyGroup.email)}
                >
                  {deleting ? "Eliminando…" : "Eliminar participante"}
                </button>
              ) : (
                <span />
              )}
              <button className="primary-button" disabled={saving} onClick={() => setHistoryEmail(null)}>
                {saving ? "Guardando…" : "Listo"}
              </button>
            </div>
          </section>
        </div>
      )}

      {messageOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!sendingMessage) setMessageOpen(false);
          }}
        >
          <section
            className="modal participant-modal participant-message-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="participant-message-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" disabled={sendingMessage} onClick={() => setMessageOpen(false)} aria-label="Cerrar">
              ×
            </button>
            <p className="eyebrow">MENSAJE A PARTICIPANTES</p>
            <h2 id="participant-message-title">Enviar mensaje a {selectedIds.size} participante{selectedIds.size === 1 ? "" : "s"}</h2>
            <p>Cada persona recibe el correo con la cabecera y el pie de la marca y con sus propios enlaces personales.</p>
            <div className="participant-message-mode" role="radiogroup" aria-label="Tipo de mensaje">
              <label className={messageMode === "template" ? "on" : ""}>
                <input type="radio" name="message-mode" checked={messageMode === "template"} onChange={() => setMessageMode("template")} />
                <span>Plantilla del evento</span>
              </label>
              <label className={messageMode === "custom" ? "on" : ""}>
                <input type="radio" name="message-mode" checked={messageMode === "custom"} onChange={() => setMessageMode("custom")} />
                <span>Mensaje nuevo</span>
              </label>
            </div>
            {messageMode === "template" ? (
              <label className="participant-message-field">
                <span>Plantilla</span>
                <select value={messageTemplate} onChange={(input) => setMessageTemplate(input.target.value)}>
                  {templateOptions.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
                <small>Se usa la versión de la plantilla configurada en el evento de cada participante (pestaña Comunicaciones).</small>
              </label>
            ) : (
              <>
                <label className="participant-message-field">
                  <span>Asunto</span>
                  <input
                    type="text"
                    maxLength={180}
                    value={messageSubject}
                    placeholder="Novedades de {{event_title}}"
                    onChange={(input) => setMessageSubject(input.target.value)}
                  />
                </label>
                <label className="participant-message-field">
                  <span>Mensaje</span>
                  <textarea
                    rows={7}
                    maxLength={10000}
                    value={messageBody}
                    placeholder={"Hola {{participant_name}},\n\n…\n\nEntrar al evento: {{access_link}}"}
                    onChange={(input) => setMessageBody(input.target.value)}
                  />
                </label>
                <div className="template-tags participant-message-tags">
                  {["{{participant_name}}", "{{event_title}}", "{{event_date}}", "{{access_link}}", "{{manage_link}}", "{{calendar_link}}", "{{schedule_link}}"].map((tag) => (
                    <button type="button" key={tag} onClick={() => setMessageBody((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${tag}`)}>{tag}</button>
                  ))}
                </div>
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="export-actions">
              <button className="secondary-action" disabled={sendingMessage} onClick={() => setMessageOpen(false)}>Cancelar</button>
              <button
                className="primary-button"
                disabled={sendingMessage || !selectedIds.size || (messageMode === "custom" && (!messageSubject.trim() || !messageBody.trim()))}
                onClick={() => void sendManualMessage()}
              >
                {sendingMessage ? "Enviando…" : `Enviar a ${selectedIds.size}`}
              </button>
            </div>
          </section>
        </div>
      )}

      {exportOpen && (
        <div className="modal-backdrop" onMouseDown={() => setExportOpen(false)}>
          <section
            className="modal export-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
            onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setExportOpen(false)} aria-label="Cerrar">×</button>
            <div className="modal-icon">↓</div>
            <h2 id="export-modal-title">Exportar participantes</h2>
            <p>
              Se exportará la vista filtrada actual ({filtered.length} registro{filtered.length === 1 ? "" : "s"}).
              Elige las columnas y el formato.
            </p>
            <div className="export-columns">
              {exportColumns.map((column) => (
                <label key={column.key}>
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(column.key)}
                    onChange={(input) =>
                      setSelectedColumns((current) => {
                        const next = new Set(current);
                        if (input.target.checked) next.add(column.key);
                        else next.delete(column.key);
                        return next;
                      })
                    }
                  />
                  <span>{column.label}</span>
                </label>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={includeCustomFields}
                  onChange={(input) => setIncludeCustomFields(input.target.checked)}
                />
                <span>Respuestas personalizadas</span>
              </label>
            </div>
            <div className="export-actions">
              <button
                className="secondary-action"
                disabled={!selectedColumns.size && !includeCustomFields}
                onClick={() => runExport("csv")}
              >
                Descargar CSV
              </button>
              <button
                className="primary-button"
                disabled={!selectedColumns.size && !includeCustomFields}
                onClick={() => runExport("xlsx")}
              >
                Descargar XLSX
              </button>
            </div>
          </section>
        </div>
      )}

      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!saving) setSelected(null);
          }}
        >
          <section
            className="modal participant-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="participant-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              disabled={saving}
              onClick={() => setSelected(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <div className="participant-modal-head">
              <span>
                {selected.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div>
                <p className="eyebrow">FICHA DEL PARTICIPANTE</p>
                <h2 id="participant-detail-title">{selected.name}</h2>
                <a href={`mailto:${selected.email}`}>{selected.email}</a>
              </div>
            </div>

            <div className="participant-detail-grid">
              <div>
                <small>EMPRESA</small>
                <b>{selected.company ?? "Sin empresa"}</b>
                <span>{selected.jobTitle ?? "Sin cargo"}</span>
              </div>
              <div>
                <small>TELÉFONO</small>
                <b>{selected.phone ?? "No registrado"}</b>
                <span>
                  Marketing: {selected.marketingConsent ? "Aceptado" : "No aceptado"}
                </span>
              </div>
              <div>
                <small>EVENTO</small>
                <b>{selected.eventTitle}</b>
                <span>{formatDate(selected.registeredAt, userTimezone)}</span>
              </div>
              <div>
                <small>ORIGEN</small>
                <b>{sourceLabels[selected.source] ?? selected.source}</b>
                <span>
                  Interacción: {selected.engagementScore ?? "Sin puntaje"}
                </span>
              </div>
            </div>

            {selected.customFields.length > 0 && (
              <div className="participant-custom-data">
                <p className="eyebrow">RESPUESTAS PERSONALIZADAS</p>
                <div>
                  {selected.customFields.map((field) => (
                    <span key={field.id}>
                      <small>{field.label}</small>
                      <b>{field.value === "true" ? "Sí" : field.value === "false" ? "No" : field.value || "—"}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <label className="participant-status-control">
              Estado del registro
              <select
                value={selected.status}
                disabled={saving}
                onChange={(input) =>
                  void patchStatus(
                    selected,
                    input.target.value as RegistrationStatus,
                  )
                }
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <span>
                El cambio se guarda de inmediato.
              </span>
            </label>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="participant-modal-actions">
              <Link href={`/events/${selected.eventSlug}`}>
                Abrir evento ↗
              </Link>
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => setSelected(null)}
              >
                {saving ? "Guardando…" : "Listo"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
