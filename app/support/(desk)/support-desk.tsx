"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useFeedbackSetter } from "@/lib/feedback";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

type Status = "new" | "in_progress" | "resolved" | "closed";
type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: Status;
  requesterName: string;
  requesterEmail: string;
  eventTitle: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  resolvedAt: string | null;
  messageCount: number;
  attachmentCount: number;
};
type Message = { id: string; authorName: string; authorRole: string; body: string; internal: boolean; createdAt: string };
type Attachment = { id: string; fileName: string; contentType: string; sizeBytes: number; uploadedByName: string; uploadedByRole: string; createdAt: string };
type TicketDetail = Ticket & {
  description: string;
  language: string;
  eventDate: string | null;
  eventUrl: string | null;
  affectedEmail: string | null;
  screenshotUrl: string | null;
  assigneeEmail: string | null;
  messages: Message[];
  attachments: Attachment[];
};
type Agent = { id: string; name: string; email: string };

const STATUS_LABELS: Record<Status, string> = { new: "Abierto", in_progress: "En gestión", resolved: "Solucionado", closed: "Sin solución" };
const STATUS_ORDER: Status[] = ["new", "in_progress", "resolved", "closed"];
const CATEGORY_LABELS: Record<string, string> = { technical: "Técnico", event: "Evento", account: "Cuenta y acceso", integration: "Integraciones", billing: "Facturación", privacy: "Privacidad y datos", other: "Otro" };

function formatDate(value: string | null) {
  if (!value) return "—";
  const parts = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: PLATFORM_TIMEZONE }).formatToParts(new Date(value));
  return parts.map((part) => part.value.replace(/\s+/g, " ")).join("");
}
function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function ticketNumber(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export default function SupportDesk({ currentUserId, canManage, initialCase }: { currentUserId: string; canManage: boolean; initialCase: string | null }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialCase);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [, setMessageState] = useState("");
  const setMessage = useFeedbackSetter(setMessageState);
  const [, setErrorState] = useState("");
  const setError = useFeedbackSetter(setErrorState, "error");

  const loadTickets = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (assignedFilter) params.set("assigned", assignedFilter);
    if (query.trim()) params.set("q", query.trim());
    const response = await fetch(`/api/support?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { data?: { tickets: Ticket[]; totals: { status: string; total: number }[]; agents: Agent[] }; error?: string };
    if (response.ok && payload.data) {
      setTickets(payload.data.tickets);
      setTotals(Object.fromEntries(payload.data.totals.map((row) => [row.status, row.total])));
      setAgents(payload.data.agents);
    } else {
      setError(payload.error ?? "No fue posible cargar los casos.");
    }
    setLoading(false);
  }, [statusFilter, assignedFilter, query, setError]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    const response = await fetch(`/api/support/${id}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { data?: TicketDetail & { agents: Agent[] }; error?: string };
    if (response.ok && payload.data) {
      setDetail(payload.data);
      setAgents(payload.data.agents);
    } else {
      setError(payload.error ?? "No fue posible abrir el caso.");
      setDetail(null);
    }
    setDetailLoading(false);
  }, [setError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTickets(), query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets, query]);
  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const patch = async (changes: { status?: Status; assignedTo?: string | null }, notice: string) => {
    if (!detail) return;
    setBusy("patch");
    const response = await fetch(`/api/support/${detail.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(changes) });
    const payload = (await response.json().catch(() => ({}))) as { data?: TicketDetail; error?: string };
    if (response.ok && payload.data) {
      setDetail({ ...payload.data, messages: payload.data.messages, attachments: payload.data.attachments });
      setMessage(notice);
      void loadTickets();
    } else {
      setError(payload.error ?? "No fue posible actualizar el caso.");
    }
    setBusy(null);
  };

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || reply.trim().length < 2) return;
    setBusy("reply");
    const response = await fetch(`/api/support/${detail.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: reply.trim(), internal }) });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      setReply("");
      setMessage(internal ? "Nota interna guardada." : `Respuesta enviada a ${detail.requesterEmail}.`);
      await loadDetail(detail.id);
      void loadTickets();
    } else {
      setError(payload.error ?? "No fue posible enviar la respuesta.");
    }
    setBusy(null);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!detail || !files || files.length === 0) return;
    setBusy("upload");
    setUploadPct(0);
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    const ok = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/support/${detail.id}/attachments`);
      xhr.upload.onprogress = (progress) => { if (progress.lengthComputable) setUploadPct(Math.round((progress.loaded / progress.total) * 100)); };
      xhr.onload = () => { try { const body = JSON.parse(xhr.responseText); resolve({ ok: xhr.status < 300, error: body.error }); } catch { resolve({ ok: xhr.status < 300 }); } };
      xhr.onerror = () => resolve({ ok: false, error: "Fallo de red al subir las evidencias." });
      xhr.send(form);
    });
    if (ok.ok) {
      setMessage("Evidencias adjuntadas al caso.");
      await loadDetail(detail.id);
      void loadTickets();
    } else {
      setError(ok.error ?? "No fue posible adjuntar las evidencias.");
    }
    setUploadPct(null);
    setBusy(null);
  };

  const openCount = (totals.new ?? 0) + (totals.in_progress ?? 0);

  return (
    <>
      <header className="module-header support-module-header">
        <div>
          <p className="eyebrow">OPERACIÓN</p>
          <h1>Soporte</h1>
          <p>Recepción, gestión y solución de los casos que reportan organizadores y participantes.</p>
        </div>
        <span className="support-header-count">{openCount} {openCount === 1 ? "caso abierto" : "casos abiertos"}</span>
      </header>

      <section className="support-stats">
        {STATUS_ORDER.map((status) => (
          <button type="button" key={status} className={`support-stat ${status} ${statusFilter === status ? "active" : ""}`} onClick={() => setStatusFilter(statusFilter === status ? "" : status)}>
            <strong>{totals[status] ?? 0}</strong>
            <span>{STATUS_LABELS[status]}</span>
          </button>
        ))}
      </section>

      <div className="support-layout">
        <section className="panel support-list-panel">
          <div className="support-filters">
            <input type="search" placeholder="Buscar por asunto, nombre o correo" value={query} onChange={(input) => setQuery(input.target.value)} aria-label="Buscar casos" />
            <select value={assignedFilter} onChange={(input) => setAssignedFilter(input.target.value)} aria-label="Filtrar por asignación">
              <option value="">Todos los agentes</option>
              <option value="me">Mis casos</option>
              <option value="none">Sin asignar</option>
              {agents.filter((agent) => agent.id !== currentUserId).map((agent) => (
                <option value={agent.id} key={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
          <div className="support-list">
            {loading ? (
              <p className="support-empty">Cargando casos…</p>
            ) : tickets.length === 0 ? (
              <p className="support-empty">No hay casos para estos filtros.</p>
            ) : (
              tickets.map((ticket) => (
                <article key={ticket.id} className={`support-row ${selectedId === ticket.id ? "selected" : ""}`} onClick={() => setSelectedId(ticket.id)}>
                  <div className="support-row-main">
                    <b>{ticket.subject}</b>
                    <small>{ticketNumber(ticket.id)} · {ticket.requesterName} · {CATEGORY_LABELS[ticket.category] ?? ticket.category}</small>
                  </div>
                  <div className="support-row-meta">
                    <span className={`support-status ${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
                    <small>{ticket.assigneeName ?? "Sin asignar"} · {formatDate(ticket.updatedAt)}</small>
                    <small>{ticket.messageCount} {ticket.messageCount === 1 ? "mensaje" : "mensajes"} · {ticket.attachmentCount} {ticket.attachmentCount === 1 ? "evidencia" : "evidencias"}</small>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel support-detail-panel">
          {!selectedId ? (
            <div className="support-empty-detail">
              <span>✉</span>
              <h2>Selecciona un caso</h2>
              <p>Verás la descripción, la conversación y las evidencias, y podrás cambiar su estado o asignarlo.</p>
            </div>
          ) : detailLoading || !detail ? (
            <p className="support-empty">Cargando caso…</p>
          ) : (
            <>
              <div className="support-detail-head">
                <div>
                  <p className="eyebrow">{ticketNumber(detail.id)} · {CATEGORY_LABELS[detail.category] ?? detail.category}</p>
                  <h2>{detail.subject}</h2>
                  <p>
                    {detail.requesterName} · <a href={`mailto:${detail.requesterEmail}`}>{detail.requesterEmail}</a> · recibido {formatDate(detail.createdAt)}
                    {detail.eventTitle ? ` · Evento: ${detail.eventTitle}` : ""}
                  </p>
                </div>
                <div className="support-detail-controls">
                  <label>
                    Estado
                    <select value={detail.status} disabled={!canManage || busy === "patch"} onChange={(input) => void patch({ status: input.target.value as Status }, `El caso pasó a ${STATUS_LABELS[input.target.value as Status]}. Se avisó al solicitante por correo.`)}>
                      {STATUS_ORDER.map((status) => (
                        <option value={status} key={status}>{STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Agente
                    <select value={detail.assignedTo ?? ""} disabled={!canManage || busy === "patch"} onChange={(input) => void patch({ assignedTo: input.target.value || null }, input.target.value ? "Caso asignado." : "Caso sin asignar.")}>
                      <option value="">Sin asignar</option>
                      {agents.map((agent) => (
                        <option value={agent.id} key={agent.id}>{agent.name}{agent.id === currentUserId ? " (yo)" : ""}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="support-description">
                <p className="eyebrow">DESCRIPCIÓN</p>
                <p>{detail.description}</p>
                {(detail.eventUrl || detail.affectedEmail || detail.screenshotUrl) && (
                  <ul>
                    {detail.eventUrl && <li>Enlace del evento: <a href={detail.eventUrl} target="_blank" rel="noreferrer">{detail.eventUrl}</a></li>}
                    {detail.affectedEmail && <li>Correo afectado: {detail.affectedEmail}</li>}
                    {detail.screenshotUrl && <li>Captura: <a href={detail.screenshotUrl} target="_blank" rel="noreferrer">{detail.screenshotUrl}</a></li>}
                  </ul>
                )}
              </div>

              <div className="support-attachments">
                <div className="support-section-head">
                  <p className="eyebrow">EVIDENCIAS ({detail.attachments.length})</p>
                  {canManage && (
                    <>
                      <input ref={fileInput} type="file" multiple hidden onChange={(input) => { void uploadFiles(input.target.files); input.target.value = ""; }} accept="image/*,application/pdf,video/*,text/plain,text/csv,.docx,.xlsx,.pptx,.zip" />
                      <button type="button" className="secondary-action" disabled={busy === "upload"} onClick={() => fileInput.current?.click()}>
                        {uploadPct !== null ? `Subiendo… ${uploadPct}%` : "Adjuntar evidencias"}
                      </button>
                    </>
                  )}
                </div>
                {detail.attachments.length === 0 ? (
                  <p className="support-muted">Sin evidencias todavía.</p>
                ) : (
                  <ul className="support-attachment-list">
                    {detail.attachments.map((file) => (
                      <li key={file.id}>
                        <a href={`/api/support/attachments/${file.id}`} target="_blank" rel="noreferrer">{file.fileName}</a>
                        <small>{formatSize(file.sizeBytes)} · {file.uploadedByRole === "agent" ? "soporte" : "solicitante"} · {file.uploadedByName} · {formatDate(file.createdAt)}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="support-thread">
                <p className="eyebrow">CONVERSACIÓN</p>
                {detail.messages.length === 0 ? (
                  <p className="support-muted">Aún no hay respuestas. El solicitante recibe cada respuesta por correo y puede contestar desde su enlace de seguimiento.</p>
                ) : (
                  detail.messages.map((message) => (
                    <article key={message.id} className={`support-message ${message.authorRole} ${message.internal ? "internal" : ""}`}>
                      <header>
                        <b>{message.authorName}</b>
                        <small>{message.internal ? "Nota interna" : message.authorRole === "agent" ? "Soporte" : "Solicitante"} · {formatDate(message.createdAt)}</small>
                      </header>
                      <p>{message.body}</p>
                    </article>
                  ))
                )}
              </div>

              {canManage && (
                <form className="support-reply" onSubmit={sendReply}>
                  <textarea value={reply} onChange={(input) => setReply(input.target.value)} placeholder={internal ? "Nota interna: solo la ve el equipo de soporte" : "Escribe la respuesta para el solicitante…"} maxLength={5000} rows={4} />
                  <div className="support-reply-actions">
                    <label className="support-internal-toggle">
                      <input type="checkbox" checked={internal} onChange={(input) => setInternal(input.target.checked)} />
                      Nota interna (no se envía al solicitante)
                    </label>
                    <button className="primary-button" disabled={busy === "reply" || reply.trim().length < 2}>
                      {busy === "reply" ? "Enviando…" : internal ? "Guardar nota" : "Enviar respuesta"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
