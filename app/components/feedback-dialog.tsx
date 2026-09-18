"use client";

import { useEffect, useRef, useState } from "react";
import { FEEDBACK_EVENT, type FeedbackDetail } from "@/lib/feedback";

const SUCCESS_AUTO_CLOSE_MS = 3200;

// Modal de confirmación o error tras guardar. Los aciertos se cierran solos a
// los pocos segundos; los errores esperan a que la persona los lea.
export default function FeedbackDialog() {
  const [current, setCurrent] = useState<FeedbackDetail | null>(null);
  const timer = useRef<number | null>(null);
  const lastKey = useRef<string>("");

  useEffect(() => {
    const onFeedback = (event: Event) => {
      const detail = (event as CustomEvent<FeedbackDetail>).detail;
      if (!detail?.text) return;
      const key = `${detail.kind}:${detail.text}:${Math.floor(Date.now() / 1500)}`;
      if (key === lastKey.current) return;
      lastKey.current = key;
      setCurrent(detail);
      if (timer.current) window.clearTimeout(timer.current);
      if (detail.kind === "success") {
        timer.current = window.setTimeout(() => setCurrent(null), SUCCESS_AUTO_CLOSE_MS);
      }
    };
    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    return () => {
      window.removeEventListener(FEEDBACK_EVENT, onFeedback);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") setCurrent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;
  const isError = current.kind === "error";
  return (
    <div className="modal-backdrop feedback-backdrop" onMouseDown={() => setCurrent(null)}>
      <section
        className={`modal feedback-dialog ${isError ? "error" : "success"}`}
        role={isError ? "alertdialog" : "status"}
        aria-modal="true"
        aria-live="polite"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="feedback-icon" aria-hidden="true">{isError ? "!" : "✓"}</span>
        <div>
          <p className="eyebrow">{isError ? "NO SE PUDO GUARDAR" : "GUARDADO"}</p>
          <p className="feedback-text">{current.text}</p>
        </div>
        <button type="button" className={isError ? "primary-button" : "secondary-button"} autoFocus onClick={() => setCurrent(null)}>
          Entendido
        </button>
      </section>
    </div>
  );
}
