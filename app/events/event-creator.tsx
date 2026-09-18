"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { PLATFORM_TIMEZONE, platformLocalToDate } from "@/lib/timezone";

type EventFormat = "live" | "simulated" | "hybrid";
type ScheduleConflict = { id: string; title: string; slug: string; startsAt: string; reasons: string[] };
type EventTemplateSummary = { id: string; name: string; durationMinutes: number };

// Modal de creación de eventos (mismo flujo que el Resumen): elegir formato,
// luego nombre, fecha y duración; el evento nace como borrador.
export default function EventCreator({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (event: { slug: string; title: string }) => void;
}) {
  const [templates, setTemplates] = useState<EventTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<EventFormat | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [scheduleConflicts, setScheduleConflicts] = useState<ScheduleConflict[]>([]);

  useEffect(() => {
    if (!open) {
      setSelectedFormat(null);
      setFormError("");
      setScheduleConflicts([]);
      setSelectedTemplateId("");
      return;
    }
    let cancelled = false;
    fetch("/api/event-templates", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: EventTemplateSummary[] } | null) => {
        if (!cancelled && payload?.data) setTemplates(payload.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const createEvent = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!selectedFormat) return;
    setSaving(true);
    setFormError("");
    const form = new FormData(formEvent.currentTarget);
    const startsAt = platformLocalToDate(String(form.get("startsAt")));
    const duration = Number(form.get("duration"));
    if (Number.isNaN(startsAt.getTime()) || !duration) {
      setFormError("Selecciona una fecha, hora y duración válidas.");
      setSaving(false);
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
      data?: { slug: string; title: string };
      error?: string;
      conflicts?: ScheduleConflict[];
      requiresConfirmation?: boolean;
    };
    if (!response.ok || !payload.data) {
      if (payload.requiresConfirmation && payload.conflicts?.length) {
        setScheduleConflicts(payload.conflicts);
        setFormError("Detectamos un solapamiento. Revisa el detalle y confirma si deseas crear el borrador de todas formas.");
      } else {
        setFormError(payload.error ?? "No fue posible crear el evento.");
      }
      setSaving(false);
      return;
    }
    setSaving(false);
    onCreated(payload.data);
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!saving) onClose(); }}>
      <section
        className="modal create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="events-create-title"
        onMouseDown={(click) => click.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Cerrar" disabled={saving}>×</button>
        {!selectedFormat ? (
          <>
            <p className="eyebrow">NUEVO EVENTO</p>
            <h2 id="events-create-title">¿Qué quieres organizar?</h2>
            <p>Elige el formato del evento para comenzar.</p>
            <div className="event-options">
              {([
                ["●", "En vivo", "Zoom + interacción en tiempo real", "live"],
                ["▷", "Simulado", "Video pregrabado con experiencia live", "simulated"],
                ["◇", "Híbrido", "Audiencia presencial y remota", "hybrid"],
              ] as const).map(([icon, title, text, format]) => (
                <button key={format} type="button" onClick={() => setSelectedFormat(format)}>
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
            <button type="button" className="back-button" onClick={() => setSelectedFormat(null)}>
              ← Cambiar formato
            </button>
            <h2 id="events-create-title">Información principal</h2>
            <p>Crearemos el evento como borrador. Las integraciones se configuran después.</p>
            <form className="event-form" onSubmit={createEvent}>
              {templates.length > 0 && (
                <label>
                  Plantilla (opcional)
                  <select value={selectedTemplateId} onChange={(input) => setSelectedTemplateId(input.target.value)}>
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
                <input name="title" required minLength={3} placeholder="Ej. Conversaciones que inspiran" />
              </label>
              <div className="form-row">
                <label>
                  Fecha y hora <small>hora de Miami</small>
                  <input name="startsAt" type="datetime-local" required onChange={() => setScheduleConflicts([])} />
                </label>
                <label>
                  Duración
                  <select name="duration" defaultValue="60" onChange={() => setScheduleConflicts([])}>
                    <option value="30">30 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="90">1 h 30 min</option>
                    <option value="120">2 horas</option>
                  </select>
                </label>
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              {scheduleConflicts.length > 0 && (
                <div className="schedule-conflict-list" role="alert">
                  <b>Conflicto de programación</b>
                  {scheduleConflicts.map((conflict) => (
                    <p key={conflict.id}>
                      <span>{conflict.title}</span>
                      <small>
                        {conflict.reasons.includes("zoom_license") ? "Licencia Zoom" : "Organizador"} ·{" "}
                        {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: PLATFORM_TIMEZONE }).format(new Date(conflict.startsAt))}
                      </small>
                    </p>
                  ))}
                </div>
              )}
              <button className="primary-button submit-button" disabled={saving}>
                {saving ? "Guardando…" : scheduleConflicts.length ? "Crear a pesar del conflicto" : "Crear borrador"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
