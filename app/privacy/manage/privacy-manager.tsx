"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

type LegalDocument = {
  id: string;
  type: "privacy" | "terms";
  version: number;
  title: string;
  summary: string;
  content: string;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type DataRequest = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  type: "access" | "correction" | "deletion" | "portability" | "restriction";
  description: string | null;
  status:
    | "submitted"
    | "verified"
    | "in_progress"
    | "completed"
    | "rejected";
  identityVerified: boolean;
  dueAt: string;
  consentAcceptedAt: string;
  retentionUntil: string;
  assignedTo: string | null;
  resolutionNotes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ConsentEvidence = {
  id: string;
  eventId: string | null;
  eventTitle: string | null;
  registrationId: string | null;
  privacyVersion: number;
  termsVersion: number;
  subjectEmailHash: string;
  marketingAccepted: boolean;
  ipAddress: string | null;
  acceptedAt: string;
};

const typeLabels = {
  access: "Acceso",
  correction: "Corrección",
  deletion: "Eliminación",
  portability: "Portabilidad",
  restriction: "Restricción",
};

const statusLabels = {
  submitted: "Recibida",
  verified: "Verificada",
  in_progress: "En proceso",
  completed: "Completada",
  rejected: "Rechazada",
};

function stableDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: PLATFORM_TIMEZONE,
  }).format(new Date(value));
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

export default function PrivacyManager({
  initialDocuments,
  initialRequests,
  initialConsents,
}: {
  initialDocuments: LegalDocument[];
  initialRequests: DataRequest[];
  initialConsents: ConsentEvidence[];
}) {
  const [tab, setTab] = useState<"documents" | "requests" | "consents">(
    "documents",
  );
  const [documents, setDocuments] = useState(initialDocuments);
  const [requests, setRequests] = useState(initialRequests);
  const [selected, setSelected] = useState<DataRequest | null>(null);
  const [saving, setSaving] = useState("");
  const [eraseConfirmation, setEraseConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeRequests = requests.filter(
    (request) =>
      request.status !== "completed" && request.status !== "rejected",
  );
  const dueSoon = activeRequests.filter(
    (request) => daysUntil(request.dueAt) <= 7,
  ).length;
  const activeDocuments = useMemo(
    () => ({
      privacy: documents.find(
        (document) =>
          document.type === "privacy" && document.status === "published",
      ),
      terms: documents.find(
        (document) =>
          document.type === "terms" && document.status === "published",
      ),
    }),
    [documents],
  );

  const publishDocument = async (
    event: FormEvent<HTMLFormElement>,
    type: "privacy" | "terms",
  ) => {
    event.preventDefault();
    setSaving(type);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/legal-documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        title: form.get("title"),
        summary: form.get("summary"),
        content: form.get("content"),
        publish: true,
      }),
    });
    const payload = (await response.json()) as {
      data?: LegalDocument;
      error?: string;
    };
    if (response.ok && payload.data) {
      setDocuments((current) => [
        payload.data!,
        ...current.map((document) =>
          document.type === type && document.status === "published"
            ? { ...document, status: "archived" as const }
            : document,
        ),
      ]);
      setMessage(`Versión ${payload.data.version} publicada correctamente.`);
    } else {
      setError(payload.error ?? "No fue posible publicar el documento.");
    }
    setSaving("");
  };

  const updateRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving("request");
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/data-rights", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        status: form.get("status"),
        identityVerified: form.get("identityVerified") === "on",
        resolutionNotes: form.get("resolutionNotes"),
      }),
    });
    const payload = (await response.json()) as {
      data?: DataRequest;
      error?: string;
    };
    if (response.ok && payload.data) {
      setRequests((current) =>
        current.map((request) =>
          request.id === payload.data!.id ? payload.data! : request,
        ),
      );
      setSelected(payload.data);
      setMessage("La solicitud y su trazabilidad fueron actualizadas.");
    } else {
      setError(payload.error ?? "No fue posible actualizar la solicitud.");
    }
    setSaving("");
  };

  const erasePersonalData = async () => {
    if (!selected) return;
    setSaving("erase");
    setMessage("");
    setError("");
    const response = await fetch(`/api/data-rights/${selected.id}/erase`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: eraseConfirmation }),
    });
    const payload = (await response.json()) as {
      data?: DataRequest;
      error?: string;
    };
    if (response.ok && payload.data) {
      setRequests((current) =>
        current.map((request) =>
          request.id === payload.data!.id ? payload.data! : request,
        ),
      );
      setSelected(payload.data);
      setEraseConfirmation("");
      setMessage("Los datos identificables fueron eliminados y la evidencia quedó anonimizada.");
    } else {
      setError(payload.error ?? "No fue posible ejecutar la eliminación.");
    }
    setSaving("");
  };

  return (
    <>
      <header className="module-header privacy-admin-header">
        <div>
          <p className="eyebrow">CUMPLIMIENTO Y DATOS</p>
          <h1>Privacidad</h1>
          <p>Versiona políticas, demuestra consentimientos y atiende derechos.</p>
        </div>
        <Link href="/privacy" target="_blank" className="secondary-action link-button">
          Abrir Centro público ↗
        </Link>
      </header>

      {message && <div className="detail-message" role="status">{message}</div>}
      {error && <div className="brand-error" role="alert">ⓘ {error}</div>}

      <section className="privacy-admin-stats">
        <article>
          <span>§</span>
          <div><strong>2</strong><p>documentos vigentes</p></div>
        </article>
        <article>
          <span>◇</span>
          <div><strong>{activeRequests.length}</strong><p>solicitudes activas</p></div>
        </article>
        <article className={dueSoon ? "warning" : ""}>
          <span>!</span>
          <div><strong>{dueSoon}</strong><p>vencen en 7 días</p></div>
        </article>
        <article>
          <span>✓</span>
          <div><strong>{initialConsents.length}</strong><p>evidencias recientes</p></div>
        </article>
      </section>

      <nav className="privacy-admin-tabs" aria-label="Secciones de privacidad">
        <button className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>
          Políticas y versiones
        </button>
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>
          Solicitudes <span>{activeRequests.length}</span>
        </button>
        <button className={tab === "consents" ? "active" : ""} onClick={() => setTab("consents")}>
          Evidencia de consentimiento
        </button>
      </nav>

      {tab === "documents" && (
        <section className="privacy-document-editor-grid">
          {(["privacy", "terms"] as const).map((type) => {
            const document = activeDocuments[type];
            if (!document) return null;
            const history = documents.filter((item) => item.type === type);
            return (
              <form
                key={`${type}-${document.id}`}
                className="panel privacy-document-editor"
                onSubmit={(event) => publishDocument(event, type)}
              >
                <header>
                  <div>
                    <p className="eyebrow">
                      {type === "privacy" ? "POLÍTICA" : "TÉRMINOS"}
                    </p>
                    <h2>{document.title}</h2>
                  </div>
                  <span>v{document.version} vigente</span>
                </header>
                <label>
                  Título
                  <input name="title" required minLength={5} maxLength={180} defaultValue={document.title} />
                </label>
                <label>
                  Resumen público
                  <textarea name="summary" required minLength={20} maxLength={500} rows={3} defaultValue={document.summary} />
                </label>
                <label>
                  Contenido
                  <textarea name="content" required minLength={100} maxLength={20_000} rows={15} defaultValue={document.content} />
                  <small>Alterna subtítulos y párrafos usando una línea en blanco.</small>
                </label>
                <footer>
                  <div>
                    <b>Historial</b>
                    {history.slice(0, 4).map((item) => (
                      <span key={item.id} className={item.status}>
                        v{item.version} · {item.status === "published" ? "vigente" : item.status === "archived" ? "archivada" : "borrador"}
                      </span>
                    ))}
                  </div>
                  <button className="primary-button" disabled={saving === type}>
                    {saving === type ? "Publicando…" : "Publicar nueva versión"}
                  </button>
                </footer>
              </form>
            );
          })}
        </section>
      )}

      {tab === "requests" && (
        <section className="panel privacy-request-queue">
          <header>
            <div>
              <p className="eyebrow">PLAZO MÁXIMO · 30 DÍAS</p>
              <h2>Solicitudes de derechos</h2>
            </div>
            <span>{requests.length} registradas</span>
          </header>
          <div className="privacy-request-table">
            <div className="privacy-request-table-head">
              <span>Solicitante</span><span>Derecho</span><span>Vencimiento</span><span>Estado</span><span />
            </div>
            {requests.map((request) => (
              <article key={request.id}>
                <div><b>{request.requesterName}</b><small>{request.requesterEmail}</small></div>
                <span>{typeLabels[request.type]}</span>
                <span className={daysUntil(request.dueAt) <= 7 && request.status !== "completed" ? "due" : ""}>
                  {stableDate(request.dueAt)}
                </span>
                <span className={`request-status ${request.status}`}>{statusLabels[request.status]}</span>
                <button onClick={() => setSelected(request)}>Gestionar</button>
              </article>
            ))}
            {!requests.length && <p className="privacy-empty">No hay solicitudes registradas.</p>}
          </div>
        </section>
      )}

      {tab === "consents" && (
        <section className="panel consent-evidence-panel">
          <header>
            <div>
              <p className="eyebrow">PRUEBA MINIMIZADA</p>
              <h2>Consentimientos versionados</h2>
              <p>El correo se conserva únicamente como huella SHA-256.</p>
            </div>
            <span>{initialConsents.length} recientes</span>
          </header>
          <div className="consent-evidence-list">
            <div className="consent-evidence-head">
              <span>Fecha</span><span>Evento</span><span>Versiones</span><span>Huella</span><span>Marketing</span>
            </div>
            {initialConsents.map((consent) => (
              <article key={consent.id}>
                <span>{stableDate(consent.acceptedAt)}</span>
                <div><b>{consent.eventTitle ?? "Evento eliminado"}</b><small>{consent.ipAddress ?? "IP no informada"}</small></div>
                <span>Priv. v{consent.privacyVersion} · Térm. v{consent.termsVersion}</span>
                <code>{consent.subjectEmailHash.slice(0, 12)}…</code>
                <span className={consent.marketingAccepted ? "yes" : "no"}>{consent.marketingAccepted ? "Sí" : "No"}</span>
              </article>
            ))}
            {!initialConsents.length && <p className="privacy-empty">Las nuevas inscripciones aparecerán aquí.</p>}
          </div>
        </section>
      )}

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && saving !== "request") setSelected(null);
        }}>
          <form className="modal privacy-request-modal" onSubmit={updateRequest}>
            <button type="button" className="modal-close" aria-label="Cerrar solicitud" onClick={() => setSelected(null)}>×</button>
            <p className="eyebrow">SOLICITUD #{selected.id.slice(0, 8)}</p>
            <h2>{typeLabels[selected.type]}</h2>
            <div className="privacy-request-identity">
              <div><small>SOLICITANTE</small><b>{selected.requesterName}</b><span>{selected.requesterEmail}</span></div>
              <div><small>FECHA LÍMITE</small><b>{stableDate(selected.dueAt)}</b><span>{Math.max(daysUntil(selected.dueAt), 0)} días restantes</span></div>
            </div>
            {selected.description && <p className="privacy-request-description">{selected.description}</p>}
            <label>
              Estado
              <select name="status" defaultValue={selected.status}>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="privacy-identity-check">
              <input name="identityVerified" type="checkbox" defaultChecked={selected.identityVerified} />
              <span><b>Identidad verificada</b><small>Obligatorio antes de entregar o eliminar información.</small></span>
            </label>
            <label>
              Notas de resolución
              <textarea name="resolutionNotes" rows={4} maxLength={2_000} defaultValue={selected.resolutionNotes ?? ""} />
            </label>
            <div className="privacy-request-modal-actions">
              {selected.identityVerified && (selected.type === "access" || selected.type === "portability") && (
                <a href={`/api/data-rights/${selected.id}/export`}>↓ Exportar datos verificados</a>
              )}
              <button className="primary-button" disabled={saving === "request"}>
                {saving === "request" ? "Guardando…" : "Guardar trazabilidad"}
              </button>
            </div>
            {selected.identityVerified &&
              selected.type === "deletion" &&
              selected.status !== "completed" && (
                <section className="privacy-erasure-control">
                  <div>
                    <b>Supresión irreversible</b>
                    <span>
                      Elimina cuenta participante, registros, mensajes y soporte;
                      conserva solo huellas y auditoría anonimizadas.
                    </span>
                  </div>
                  <input
                    value={eraseConfirmation}
                    onChange={(event) => setEraseConfirmation(event.target.value)}
                    placeholder={selected.requesterEmail}
                    aria-label="Confirmar correo para eliminación"
                  />
                  <button
                    type="button"
                    disabled={
                      saving === "erase" ||
                      eraseConfirmation.trim().toLowerCase() !==
                        selected.requesterEmail
                    }
                    onClick={erasePersonalData}
                  >
                    {saving === "erase" ? "Eliminando…" : "Eliminar datos personales"}
                  </button>
                </section>
              )}
          </form>
        </div>
      )}
    </>
  );
}
