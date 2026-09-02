"use client";

import { useState } from "react";
import { platformLocalToDate, toPlatformDateTimeInput } from "@/lib/timezone";

// Cambio de fecha y hora del evento. Solo se ofrece mientras el evento está
// en borrador o en preparación; al guardar, la API desplaza sesiones y
// recordatorios pendientes el mismo intervalo.
export default function EventDateEditor({
  slug,
  status,
  startsAt,
  endsAt,
}: {
  slug: string;
  status: string;
  startsAt: string;
  endsAt: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [value, setValue] = useState(() => toPlatformDateTimeInput(startsAt));
  const initialDuration = Math.max(
    15,
    Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000),
  );
  const [duration, setDuration] = useState(String(initialDuration));

  if (status !== "draft" && status !== "preparing") return null;

  const save = async () => {
    const start = platformLocalToDate(value);
    const minutes = Number(duration);
    if (Number.isNaN(start.getTime()) || !minutes) {
      setError("Indica una fecha, hora y duración válidas.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch(`/api/events/${slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + minutes * 60000).toISOString(),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "No fue posible cambiar la fecha.");
      setSaving(false);
      return;
    }
    window.location.reload();
  };

  if (!open) {
    return (
      <button type="button" className="event-date-edit-toggle" onClick={() => setOpen(true)}>
        Cambiar fecha y hora
      </button>
    );
  }

  return (
    <div className="event-date-editor" role="group" aria-label="Cambiar fecha y hora">
      <label>
        Nueva fecha y hora <small>hora de Miami</small>
        <input
          type="datetime-local"
          value={value}
          onChange={(input) => setValue(input.target.value)}
          disabled={saving}
        />
      </label>
      <label>
        Duración
        <select value={duration} onChange={(input) => setDuration(input.target.value)} disabled={saving}>
          {[30, 45, 60, 90, 120, 180, 240].map((minutes) => (
            <option value={String(minutes)} key={minutes}>
              {minutes < 60 ? `${minutes} min` : `${minutes / 60} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`}
            </option>
          ))}
          {![30, 45, 60, 90, 120, 180, 240].includes(Number(duration)) && (
            <option value={duration}>{duration} min</option>
          )}
        </select>
      </label>
      <div className="event-date-editor-actions">
        <button type="button" className="secondary-action" disabled={saving} onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button type="button" className="primary-button" disabled={saving} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar fecha"}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <small>Las sesiones y los recordatorios pendientes se mueven al nuevo horario.</small>
    </div>
  );
}
