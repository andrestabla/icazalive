"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Status = "new" | "in_progress" | "resolved" | "closed";
type Message = { id: string; authorName: string; authorRole: string; body: string; createdAt: string };
type Attachment = { id: string; fileName: string; sizeBytes: number; uploadedByRole: string; uploadedByName: string; createdAt: string };
type Ticket = {
  id: string; subject: string; description: string; category: string; status: Status; requesterName: string; requesterEmail: string;
  eventTitle: string | null; assigneeName: string | null; createdAt: string; updatedAt: string; resolvedAt: string | null;
  messages: Message[]; attachments: Attachment[]; supportEmail: string; supportHours: string;
};
const STATUS_LABELS: Record<Status, string> = { new: "Abierto", in_progress: "En gestión", resolved: "Solucionado", closed: "Sin solución" };
const STATUS_HELP: Record<Status, string> = {
  new: "Recibimos tu caso y pronto un agente lo tomará.",
  in_progress: "Un agente de soporte está trabajando en tu caso.",
  resolved: "El caso quedó solucionado. Si el problema persiste, responde y lo reabrimos.",
  closed: "No fue posible resolverlo. Si tienes información nueva, responde y lo revisamos de nuevo.",
};
function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" }).format(new Date(value)).replace(/\s+/g, " ");
}
function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function TicketView({ token, organization, logo }: { token: string; organization: string; logo: string | null }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const base = `/api/support/ticket/${encodeURIComponent(token)}`;

  const load = useCallback(async () => {
    const response = await fetch(base, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { data?: Ticket; error?: string };
    if (response.ok && payload.data) setTicket(payload.data);
    else setError(payload.error ?? "No fue posible cargar el caso.");
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reply.trim().length < 2) return;
    setBusy("reply"); setError(""); setNotice("");
    const response = await fetch(`${base}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: reply.trim() }) });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) { setReply(""); setNotice("Tu mensaje quedó registrado. El equipo de soporte fue avisado."); await load(); }
    else setError(payload.error ?? "No fue posible enviar el mensaje.");
    setBusy(null);
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy("upload"); setError(""); setNotice("");
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    const response = await fetch(`${base}/attachments`, { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) { setNotice("Evidencias adjuntadas. El equipo de soporte fue avisado."); await load(); }
    else setError(payload.error ?? "No fue posible adjuntar las evidencias.");
    setBusy(null);
  };

  return (
    <main className="ticket-shell">
      <header className="ticket-brand">
        {logo ? <img src={logo} alt="" /> : <span className="ticket-monogram">{organization.slice(0, 1)}</span>}
        <b>{organization}</b>
        <small>Soporte</small>
      </header>
      {error && !ticket && <p className="ticket-error">{error}</p>}
      {ticket && (
        <section className="ticket-card">
          <div className="ticket-head">
            <p className="eyebrow">CASO #{ticket.id.slice(0, 8).toUpperCase()}</p>
            <h1>{ticket.subject}</h1>
            <div className={`ticket-status ${ticket.status}`}>
              <b>{STATUS_LABELS[ticket.status]}</b>
              <span>{STATUS_HELP[ticket.status]}</span>
            </div>
            <p className="ticket-meta">
              Abierto el {formatDate(ticket.createdAt)} por {ticket.requesterName}
              {ticket.assigneeName ? ` · Atiende: ${ticket.assigneeName}` : ""}
              {ticket.eventTitle ? ` · Evento: ${ticket.eventTitle}` : ""}
            </p>
          </div>

          <div className="ticket-block">
            <p className="eyebrow">TU DESCRIPCIÓN</p>
            <p className="ticket-text">{ticket.description}</p>
          </div>

          <div className="ticket-block">
            <div className="ticket-block-head">
              <p className="eyebrow">EVIDENCIAS ({ticket.attachments.length})</p>
              <input ref={fileInput} type="file" multiple hidden onChange={(input) => { void upload(input.target.files); input.target.value = ""; }} accept="image/*,application/pdf,video/*,text/plain,text/csv,.docx,.xlsx,.pptx,.zip" />
              <button type="button" className="ticket-secondary" disabled={busy === "upload"} onClick={() => fileInput.current?.click()}>
                {busy === "upload" ? "Subiendo…" : "Adjuntar evidencias"}
              </button>
            </div>
            <small className="ticket-hint">Capturas, PDF o video de hasta 25 MB. Máximo 5 archivos por envío.</small>
            {ticket.attachments.length > 0 && (
              <ul className="ticket-files">
                {ticket.attachments.map((file) => (
                  <li key={file.id}>
                    <a href={`/api/support/attachments/${file.id}?token=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer">{file.fileName}</a>
                    <small>{formatSize(file.sizeBytes)} · {file.uploadedByRole === "agent" ? "soporte" : "tú"} · {formatDate(file.createdAt)}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ticket-block">
            <p className="eyebrow">CONVERSACIÓN</p>
            {ticket.messages.length === 0 ? (
              <p className="ticket-hint">Aún no hay respuestas. Te avisaremos por correo a {ticket.requesterEmail} con cada avance.</p>
            ) : (
              <div className="ticket-thread">
                {ticket.messages.map((message) => (
                  <article key={message.id} className={`ticket-message ${message.authorRole}`}>
                    <header><b>{message.authorRole === "agent" ? `${message.authorName} · Soporte` : message.authorName}</b><small>{formatDate(message.createdAt)}</small></header>
                    <p>{message.body}</p>
                  </article>
                ))}
              </div>
            )}
            <form className="ticket-reply" onSubmit={send}>
              <textarea value={reply} onChange={(input) => setReply(input.target.value)} rows={4} maxLength={5000} placeholder="Escribe tu respuesta o añade información…" />
              <div className="ticket-reply-actions">
                {notice && <span className="ticket-notice">{notice}</span>}
                {error && ticket && <span className="ticket-error-inline">{error}</span>}
                <button className="ticket-primary" disabled={busy === "reply" || reply.trim().length < 2}>{busy === "reply" ? "Enviando…" : "Enviar mensaje"}</button>
              </div>
            </form>
          </div>

          <footer className="ticket-foot">
            <span>{ticket.supportHours}</span>
            <a href={`mailto:${ticket.supportEmail}`}>{ticket.supportEmail}</a>
          </footer>
        </section>
      )}
    </main>
  );
}
