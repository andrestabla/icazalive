#!/usr/bin/env python3
"""Participantes: selección múltiple (todos o uno a uno) y "Enviar mensaje"
con plantilla del evento o mensaje nuevo, siempre con cabecera y pie de la
marca. La ruta app/api/participants/message/route.ts se copia completa."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def patch(rel, pairs, marker):
    p = root / rel; s = p.read_text(encoding="utf-8")
    if marker in s: print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if old not in s: print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8"); print(f"OK {rel}: aplicado")

STATE = '''  const [exportOpen, setExportOpen] = useState(false);
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
  };'''

patch("app/participants/participants-list.tsx", [
    ("  const [exportOpen, setExportOpen] = useState(false);", STATE),
    # Cabecera de la tabla: casilla "seleccionar todos"
    ('''        <div className="participant-table-head">
          <span>PARTICIPANTE</span>''',
     '''        <div className="participant-table-head">
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
          <span>PARTICIPANTE</span>'''),
    # Fila agrupada: casilla del grupo
    ('''            <div className="participant-row" key={group.email}>
              <div className="participant-person">''',
     '''            <div className="participant-row" key={group.email}>
              <span className="participant-select-cell">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar a ${group.name}`}
                  checked={group.records.every((record) => selectedIds.has(record.id))}
                  onChange={(input) => toggleSelected(group.records.map((record) => record.id), input.target.checked)}
                />
              </span>
              <div className="participant-person">'''),
    # Fila plana: casilla del registro
    ('''            <div className="participant-row" key={record.id}>
              <div className="participant-person">''',
     '''            <div className="participant-row" key={record.id}>
              <span className="participant-select-cell">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar a ${record.name}`}
                  checked={selectedIds.has(record.id)}
                  onChange={(input) => toggleSelected([record.id], input.target.checked)}
                />
              </span>
              <div className="participant-person">'''),
    # Botón en la cabecera
    ('''        <div className="participant-header-actions">
          <button
            className="secondary-action"
            disabled={!filtered.length || loading}
            onClick={() => setExportOpen(true)}
          >''',
     '''        <div className="participant-header-actions">
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
          >'''),
    # Modal de envío
    ('''      {exportOpen && (''',
     '''      {messageOpen && (
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
                    placeholder={"Hola {{participant_name}},\\n\\n…\\n\\nEntrar al evento: {{access_link}}"}
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

      {exportOpen && ('''),
], "participant-message-modal")

# CSS: columna de selección y modal
css = root / "app/globals.css"; g = css.read_text(encoding="utf-8")
old_cols = "grid-template-columns: minmax(180px, 1.3fr) minmax(125px, .9fr) minmax(145px, 1.05fr) 110px 82px 58px;"
new_cols = "grid-template-columns: 26px minmax(180px, 1.3fr) minmax(125px, .9fr) minmax(145px, 1.05fr) 110px 82px 58px;"
if old_cols in g:
    g = g.replace(old_cols, new_cols, 1); print("OK globals.css: columna de selección")
elif new_cols in g:
    print("OK globals.css: columna ya presente")
else:
    print("ERROR globals.css: grid de participantes no encontrado"); sys.exit(1)
if ".participant-message-modal" not in g:
    g = g.rstrip("\n") + """

/* Participantes: selección múltiple y envío de mensajes. */
.participant-select-cell { display: flex; align-items: center; justify-content: center; }
.participant-select-cell input { width: 16px; height: 16px; accent-color: #6241d1; cursor: pointer; }
.participant-message-button:not(:disabled) { border-color: #c9bcf5; color: #5b3bd1; }
.participant-message-modal { width: min(640px, 100%); }
.participant-message-modal > p:not(.eyebrow) { margin: 0 0 14px; color: #7f7b8b; font-size: 13px; }
.participant-message-mode { display: flex; gap: 8px; margin-bottom: 14px; }
.participant-message-mode label { flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid #e3dfe8; border-radius: 10px; font-size: 13px; font-weight: 640; cursor: pointer; }
.participant-message-mode label.on { border-color: #6241d1; background: #f4f0ff; color: #4d2fbf; }
.participant-message-field { display: grid; gap: 6px; margin-bottom: 12px; font-size: 12px; font-weight: 650; color: #575260; }
.participant-message-field input, .participant-message-field select, .participant-message-field textarea { width: 100%; box-sizing: border-box; padding: 9px 11px; border: 1px solid #d9d5e0; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 400; }
.participant-message-field textarea { resize: vertical; }
.participant-message-field small { color: #8e8998; font-weight: 400; font-size: 11px; }
.participant-message-tags { margin: 0 0 8px; }
.participant-message-tags button { border: 1px solid #e0dbea; border-radius: 6px; background: #f7f5fb; color: #5b3bd1; padding: 4px 7px; font: inherit; font-size: 11px; cursor: pointer; }
"""
    print("OK globals.css: estilos de mensaje")
css.write_text(g, encoding="utf-8")
print("LISTO enviar mensaje a participantes")
