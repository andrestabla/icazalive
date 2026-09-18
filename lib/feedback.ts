"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

// Confirmaciones y errores tras guardar, en un modal común a toda la
// plataforma. Los paneles siguen guardando su mensaje en su propio estado
// (para el texto en línea) y, además, lo anuncian aquí; el componente
// FeedbackDialog (montado en el layout raíz) lo muestra.

export type FeedbackKind = "success" | "error";
export type FeedbackDetail = { text: string; kind: FeedbackKind };

export const FEEDBACK_EVENT = "icaza:feedback";

const ERROR_PATTERN =
  /no fue posible|no se pudo|no pudimos|error|inv[áa]lid|no v[áa]lid|revisa|fall[óo]|rechaz|demasiad|no autoriz|no encontrad|incorrect|expir[óo]|selecciona al menos|escribe |faltan?\b|⚠|no está|no existe|sin permiso|no eres/i;

export function inferFeedbackKind(text: string): FeedbackKind {
  return ERROR_PATTERN.test(text) ? "error" : "success";
}

export function notifyFeedback(text: string, kind?: FeedbackKind) {
  const clean = text.trim();
  if (!clean || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<FeedbackDetail>(FEEDBACK_EVENT, {
      detail: { text: clean.replace(/^[✓⚠ⓘ]\s*/, ""), kind: kind ?? inferFeedbackKind(clean) },
    }),
  );
}

type NoticeLike = { text: string; error?: boolean } | string | null | undefined;

/**
 * Envuelve un setter de estado de mensaje (texto plano o `{ text, error }`)
 * para que, además de actualizar el estado, muestre el modal de confirmación
 * o de error. Los vacíos y los actualizadores funcionales no se anuncian.
 */
export function useFeedbackSetter<T>(
  setState: Dispatch<SetStateAction<T>>,
  kind?: FeedbackKind,
): Dispatch<SetStateAction<T>> {
  return useCallback(
    (value: SetStateAction<T>) => {
      setState(value);
      if (typeof value === "function") return;
      const notice = value as unknown as NoticeLike;
      if (typeof notice === "string") {
        notifyFeedback(notice, kind);
      } else if (notice && typeof notice === "object" && typeof notice.text === "string") {
        notifyFeedback(notice.text, notice.error ? "error" : kind ?? inferFeedbackKind(notice.text));
      }
    },
    [setState, kind],
  );
}
