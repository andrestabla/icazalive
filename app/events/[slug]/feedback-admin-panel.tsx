"use client";

import { useEffect, useState } from "react";

type FeedbackSummary = {
  enabled: boolean;
  question: string | null;
  total: number;
  average: number | null;
  distribution: { rating: number; count: number }[];
  responses: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    updatedAt: string;
    participantName: string;
    participantEmail: string;
  }[];
};

function csvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function FeedbackAdminPanel({
  eventSlug,
  feedbackEnabled,
  feedbackQuestion,
  saving,
  onConfigChange,
}: {
  eventSlug: string;
  feedbackEnabled: boolean;
  feedbackQuestion: string | null;
  saving: boolean;
  onConfigChange: (changes: {
    feedbackEnabled?: boolean;
    feedbackQuestion?: string | null;
  }) => void;
}) {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventSlug}/feedback`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: FeedbackSummary } | null) => {
        if (!cancelled && payload?.data) setSummary(payload.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventSlug, feedbackEnabled]);

  const exportCsv = () => {
    if (!summary?.responses.length) return;
    const rows = [
      ["Participante", "Correo", "Calificación", "Comentario", "Fecha"],
      ...summary.responses.map((item) => [
        item.participantName,
        item.participantEmail,
        item.rating,
        item.comment ?? "",
        new Date(item.updatedAt).toISOString(),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `feedback-${eventSlug}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxCount = Math.max(1, ...(summary?.distribution.map((d) => d.count) ?? [1]));

  return (
    <section className="panel feedback-admin-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SATISFACCIÓN</p>
          <h2>Feedback post-evento</h2>
          <p>Calificaciones enviadas por los asistentes desde su enlace personal al finalizar el evento.</p>
        </div>
        <button onClick={exportCsv} disabled={!summary?.responses.length}>
          Exportar CSV <span>↓</span>
        </button>
      </div>

      <div className="feedback-admin-config">
        <label className="feedback-toggle">
          <input
            type="checkbox"
            checked={feedbackEnabled}
            disabled={saving}
            onChange={(input) => onConfigChange({ feedbackEnabled: input.target.checked })}
          />
          <span>Encuesta activa al finalizar el evento</span>
        </label>
        <input
          type="text"
          maxLength={300}
          placeholder="¿Cómo calificarías tu experiencia en el evento?"
          defaultValue={feedbackQuestion ?? ""}
          disabled={saving || !feedbackEnabled}
          onBlur={(input) => {
            const value = input.target.value.trim();
            if ((feedbackQuestion ?? "") !== value) {
              onConfigChange({ feedbackQuestion: value || null });
            }
          }}
        />
      </div>

      {summary && summary.total > 0 ? (
        <div className="feedback-admin-content">
          <div className="feedback-admin-score">
            <strong>{summary.average?.toLocaleString("es-CO")}</strong>
            <div aria-hidden>
              {[1, 2, 3, 4, 5].map((value) => (
                <span key={value} className={summary.average && value <= Math.round(summary.average) ? "filled" : ""}>★</span>
              ))}
            </div>
            <small>{summary.total} respuesta{summary.total === 1 ? "" : "s"}</small>
          </div>
          <div className="feedback-admin-distribution">
            {[...summary.distribution].reverse().map((item) => (
              <div key={item.rating}>
                <small>{item.rating}★</small>
                <div><span style={{ width: `${(item.count / maxCount) * 100}%` }} /></div>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
          <div className="feedback-admin-comments">
            {summary.responses.filter((item) => item.comment).slice(0, 6).map((item) => (
              <article key={item.id}>
                <header>
                  <b>{item.participantName}</b>
                  <i>{"★".repeat(item.rating)}</i>
                </header>
                <p>{item.comment}</p>
              </article>
            ))}
            {!summary.responses.some((item) => item.comment) && (
              <p className="feedback-admin-empty">Aún no hay comentarios escritos.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="feedback-admin-empty-state">
          {feedbackEnabled
            ? "Todavía no hay respuestas. La encuesta aparece en el enlace personal de cada asistente cuando el evento finaliza."
            : "La encuesta está desactivada para este evento."}
        </div>
      )}
    </section>
  );
}
