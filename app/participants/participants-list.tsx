"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { downloadXlsx } from "@/lib/xlsx-export";
import ParticipantInviter from "./participant-inviter";

type RegistrationStatus =
  | "registered"
  | "confirmed"
  | "attended"
  | "absent"
  | "cancelled";

type ParticipantRecord = {
  id: string;
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

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
      setSelected(updated);
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
            <strong>{records.length}</strong>
            <p>Registros totales</p>
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
          <span>PARTICIPANTE</span>
          <span>EMPRESA / CARGO</span>
          <span>EVENTO</span>
          <span>REGISTRO</span>
          <span>ESTADO</span>
          <span>ACCIÓN</span>
        </div>
        {loading ? (
          <div className="table-empty">Cargando participantes…</div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            No hay participantes para los filtros seleccionados.
          </div>
        ) : (
          paginated.map((record) => (
            <div className="participant-row" key={record.id}>
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
        {!loading && filtered.length > PAGE_SIZE && (
          <footer className="participants-pagination">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              ← Anterior
            </button>
            <span>
              Página <b>{currentPage}</b> de {pageCount} · {filtered.length}{" "}
              registros
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
                Este cambio se guarda inmediatamente en la base local.
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
