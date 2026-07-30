"use client";

import { useState, type FormEvent } from "react";

type AuditOutcome = "success" | "denied" | "failure";

type AuditEntry = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: AuditOutcome;
  summary: string;
  details: Record<string, string | number | boolean | null> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

type AuditData = {
  entries: AuditEntry[];
  summary: {
    total: number;
    success: number;
    denied: number;
    failure: number;
  };
  pagination: { limit: number; offset: number };
};

const resourceLabels: Record<string, string> = {
  authentication: "Autenticación",
  event: "Eventos",
  team_member: "Equipo",
  integration: "Integraciones",
  identity_policy: "SSO/MFA",
  brand: "Marca",
  registration: "Participantes",
  session: "Transmisión",
  communication: "Comunicaciones",
  interaction: "Interacción",
  support_request: "Soporte",
  legal_document: "Privacidad",
  data_request: "Derechos de datos",
  consent: "Consentimiento",
};

const actionLabels: Record<string, string> = {
  "auth.login.succeeded": "Inicio de sesión",
  "auth.login.failed": "Acceso fallido",
  "auth.login.denied": "Acceso rechazado",
  "auth.login.blocked": "Cuenta bloqueada",
  "auth.logout": "Cierre de sesión",
  "team.member.created": "Miembro creado",
  "team.member.updated": "Miembro actualizado",
  "integration.updated": "Integración actualizada",
  "integration.checked": "Integración revisada",
  "security.identity.updated": "Política SSO/MFA",
  "brand.updated": "Marca actualizada",
  "event.created": "Evento creado",
  "event.duplicated": "Evento duplicado",
  "event.updated": "Evento actualizado",
  "event.create.denied": "Creación rechazada",
  "event.update.denied": "Actualización rechazada",
  "participant.status.updated": "Participante actualizado",
  "participant.invitation.batch.created": "Invitaciones preparadas",
  "registration.field.created": "Campo de registro creado",
  "registration.field.updated": "Campo de registro actualizado",
  "registration.field.deleted": "Campo de registro eliminado",
  "registration.self_service.updated": "Inscripción actualizada",
  "registration.self_service.cancelled": "Inscripción cancelada",
  "registration.self_service.reactivated": "Inscripción reactivada",
  "registration.calendar.downloaded": "Calendario descargado",
  "streaming.updated": "Transmisión actualizada",
  "streaming.technical_check": "Revisión técnica",
  "session.created": "Sesión creada",
  "session.updated": "Sesión actualizada",
  "session.deleted": "Sesión eliminada",
  "communication.updated": "Comunicación actualizada",
  "interaction.poll.created": "Encuesta creada",
  "interaction.poll.opened": "Encuesta abierta",
  "interaction.poll.closed": "Encuesta cerrada",
  "interaction.question.moderated": "Pregunta moderada",
  "interaction.content.blocked": "Contenido bloqueado",
  "interaction.chat.removed": "Mensaje retirado",
  "interaction.message.public.created": "Mensaje público",
  "interaction.message.backstage.created": "Mensaje de producción",
  "interaction.participant.mute": "Participante silenciado",
  "interaction.participant.unmute": "Silencio retirado",
  "interaction.participant.block": "Participante bloqueado",
  "interaction.participant.unblock": "Participante desbloqueado",
  "interaction.resource.created": "Recurso agregado",
  "interaction.resource.shown": "Recurso publicado",
  "interaction.resource.hidden": "Recurso ocultado",
  "support.request.created": "Solicitud de soporte",
  "privacy.document.published": "Documento legal publicado",
  "privacy.data_request.created": "Solicitud de datos",
  "privacy.data_request.updated": "Solicitud de datos actualizada",
  "privacy.consent.recorded": "Consentimiento registrado",
  "privacy.data_exported": "Datos personales exportados",
  "privacy.data_erased": "Datos personales eliminados",
};

const outcomeLabels: Record<AuditOutcome, string> = {
  success: "Correcto",
  denied: "Rechazado",
  failure: "Fallido",
};

function formatStableDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts
      .find((item) => item.type === type)
      ?.value.replace(/\s+/g, " ") ?? "";
  return `${part("day")} ${part("month")} ${part("year")} · ${part("hour")}:${part("minute")}:${part("second")} ${part("dayPeriod")}`.trim();
}

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function AuditLogClient({
  initialData,
}: {
  initialData: AuditData;
}) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadEntries = async ({
    reset = false,
  }: {
    reset?: boolean;
  } = {}) => {
    setLoading(true);
    setError("");
    const parameters = new URLSearchParams({ limit: "100" });
    if (!reset && query.trim()) parameters.set("query", query.trim());
    if (!reset && outcome) parameters.set("outcome", outcome);
    if (!reset && resourceType) parameters.set("resourceType", resourceType);

    try {
      const response = await fetch(`/api/audit?${parameters.toString()}`, {
        headers: { accept: "application/json" },
      });
      const payload = (await response.json()) as {
        data?: AuditData;
        error?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "No fue posible consultar la bitácora.");
      }
      setData(payload.data);
      if (reset) {
        setQuery("");
        setOutcome("");
        setResourceType("");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible consultar la bitácora.",
      );
    } finally {
      setLoading(false);
    }
  };

  const submitFilters = (event: FormEvent) => {
    event.preventDefault();
    void loadEntries();
  };

  const exportCsv = () => {
    const header = [
      "Fecha",
      "Resultado",
      "Actor",
      "Correo",
      "Acción",
      "Recurso",
      "ID de recurso",
      "Resumen",
      "IP",
    ];
    const rows = data.entries.map((entry) => [
      entry.createdAt,
      outcomeLabels[entry.outcome],
      entry.actorName ?? "Sistema",
      entry.actorEmail ?? "",
      entry.action,
      resourceLabels[entry.resourceType] ?? entry.resourceType,
      entry.resourceId ?? "",
      entry.summary,
      entry.ipAddress ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvValue).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `auditoria-icaza-live-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="module-header audit-module-header">
        <div>
          <p className="eyebrow">SEGURIDAD Y CUMPLIMIENTO</p>
          <h1>Auditoría</h1>
          <p>
            Historial persistente de accesos y cambios administrativos de la
            plataforma.
          </p>
        </div>
        <button
          className="secondary-action"
          disabled={!data.entries.length}
          onClick={exportCsv}
        >
          ↓ Exportar CSV
        </button>
      </header>

      <section className="audit-stats">
        <article>
          <span className="audit-stat-icon purple">≋</span>
          <div>
            <strong>{data.summary.total}</strong>
            <p>acciones registradas</p>
          </div>
        </article>
        <article>
          <span className="audit-stat-icon green">✓</span>
          <div>
            <strong>{data.summary.success}</strong>
            <p>operaciones correctas</p>
          </div>
        </article>
        <article>
          <span className="audit-stat-icon amber">!</span>
          <div>
            <strong>{data.summary.denied}</strong>
            <p>acciones rechazadas</p>
          </div>
        </article>
        <article>
          <span className="audit-stat-icon red">×</span>
          <div>
            <strong>{data.summary.failure}</strong>
            <p>intentos fallidos</p>
          </div>
        </article>
      </section>

      <form className="panel audit-filters" onSubmit={submitFilters}>
        <label className="audit-search">
          <span>⌕</span>
          <input
            aria-label="Buscar en auditoría"
            maxLength={120}
            placeholder="Buscar actor, acción o recurso…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar por resultado"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
        >
          <option value="">Todos los resultados</option>
          <option value="success">Correctos</option>
          <option value="denied">Rechazados</option>
          <option value="failure">Fallidos</option>
        </select>
        <select
          aria-label="Filtrar por módulo"
          value={resourceType}
          onChange={(event) => setResourceType(event.target.value)}
        >
          <option value="">Todos los módulos</option>
          {Object.entries(resourceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="primary-button" disabled={loading}>
          {loading ? "Consultando…" : "Aplicar"}
        </button>
        <button
          type="button"
          className="audit-clear"
          disabled={loading}
          onClick={() => void loadEntries({ reset: true })}
        >
          Limpiar
        </button>
      </form>

      {error && (
        <div className="team-error" role="alert">
          ⓘ {error}
        </div>
      )}

      <section className="panel audit-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">REGISTRO DE ACTIVIDAD</p>
            <h2>Acciones administrativas</h2>
            <p>Los registros se muestran del más reciente al más antiguo.</p>
          </div>
          <span>{data.entries.length} visibles</span>
        </div>
        <div className="audit-table">
          <div className="audit-table-head">
            <span>FECHA</span>
            <span>ACTOR</span>
            <span>ACCIÓN</span>
            <span>RECURSO</span>
            <span>RESULTADO</span>
            <span></span>
          </div>
          {data.entries.map((entry) => (
            <article key={entry.id}>
              <div className="audit-date">
                <b>{formatStableDateTime(entry.createdAt)}</b>
                <small>{entry.ipAddress || "IP no disponible"}</small>
              </div>
              <div className="audit-actor">
                <span>
                  {(entry.actorName ?? entry.actorEmail ?? "S")
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <p>
                  <b>{entry.actorName || "Actor no identificado"}</b>
                  <small>{entry.actorEmail || "Sistema"}</small>
                </p>
              </div>
              <div className="audit-action">
                <b>{actionLabels[entry.action] ?? entry.action}</b>
                <small>{entry.summary}</small>
              </div>
              <span className="audit-resource">
                {resourceLabels[entry.resourceType] ?? entry.resourceType}
              </span>
              <span className={`audit-outcome ${entry.outcome}`}>
                {outcomeLabels[entry.outcome]}
              </span>
              <button
                aria-label={`Ver detalle de ${actionLabels[entry.action] ?? entry.action}`}
                onClick={() => setSelected(entry)}
              >
                Ver detalle
              </button>
            </article>
          ))}
          {!data.entries.length && (
            <div className="audit-empty">
              <span>≋</span>
              <h3>No hay registros para estos filtros</h3>
              <p>Prueba con otra búsqueda o limpia los filtros.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel audit-integrity-note">
        <span>◇</span>
        <div>
          <p className="eyebrow">INTEGRIDAD LOCAL</p>
          <h2>Registro independiente de la actividad visual</h2>
          <p>
            Cada entrada conserva actor, fecha, recurso, resultado y contexto
            técnico. En producción puede enviarse además a un servicio de logs
            centralizado.
          </p>
        </div>
      </section>

      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="modal audit-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-detail-title"
          >
            <button
              className="modal-close"
              aria-label="Cerrar detalle"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <p className="eyebrow">DETALLE DE AUDITORÍA</p>
            <h2 id="audit-detail-title">
              {actionLabels[selected.action] ?? selected.action}
            </h2>
            <p>{selected.summary}</p>
            <div className="audit-detail-grid">
              <div>
                <small>FECHA</small>
                <b>{formatStableDateTime(selected.createdAt)}</b>
              </div>
              <div>
                <small>RESULTADO</small>
                <b>{outcomeLabels[selected.outcome]}</b>
              </div>
              <div>
                <small>ACTOR</small>
                <b>{selected.actorName || selected.actorEmail || "Sistema"}</b>
              </div>
              <div>
                <small>RECURSO</small>
                <b>
                  {resourceLabels[selected.resourceType] ??
                    selected.resourceType}
                </b>
              </div>
              <div>
                <small>ID DEL RECURSO</small>
                <code>{selected.resourceId || "No aplica"}</code>
              </div>
              <div>
                <small>DIRECCIÓN IP</small>
                <code>{selected.ipAddress || "No disponible"}</code>
              </div>
            </div>
            <div className="audit-detail-data">
              <small>CONTEXTO REGISTRADO</small>
              {selected.details && Object.keys(selected.details).length ? (
                <dl>
                  {Object.entries(selected.details).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{String(value ?? "—")}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>Esta acción no requiere información adicional.</p>
              )}
            </div>
            <button
              className="primary-button"
              onClick={() => setSelected(null)}
            >
              Cerrar
            </button>
          </section>
        </div>
      )}
    </>
  );
}
