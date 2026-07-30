"use client";

import { useEffect, useState } from "react";

type FeedbackData = {
  available: boolean;
  question: string;
  response: { rating: number; comment: string | null } | null;
};

export default function FeedbackCard({
  eventSlug,
  accessToken,
}: {
  eventSlug: string;
  accessToken: string;
}) {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/events/${eventSlug}/feedback`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: FeedbackData } | null) => {
        if (cancelled || !payload?.data) return;
        setData(payload.data);
        if (payload.data.response) {
          setRating(payload.data.response.rating);
          setComment(payload.data.response.comment ?? "");
          setSaved(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventSlug, accessToken]);

  if (!data?.available) return null;

  const submit = async () => {
    if (!rating) return;
    setSaving(true);
    setNotice("");
    const response = await fetch(`/api/public/events/${eventSlug}/feedback`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ rating, comment }),
    });
    const payload = (await response.json()) as { error?: string };
    if (response.ok) {
      setSaved(true);
      setNotice("¡Gracias! Tu opinión quedó registrada.");
    } else {
      setNotice(payload.error ?? "No fue posible guardar tu calificación.");
    }
    setSaving(false);
  };

  return (
    <section className="feedback-card" aria-label="Encuesta de satisfacción">
      <p className="eyebrow">TU OPINIÓN</p>
      <h2>{data.question}</h2>
      <div className="feedback-stars" role="radiogroup" aria-label="Calificación de 1 a 5">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} de 5`}
            className={value <= rating ? "active" : ""}
            disabled={saving}
            onClick={() => {
              setRating(value);
              setSaved(false);
            }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        maxLength={1000}
        placeholder="Cuéntanos qué funcionó y qué podemos mejorar (opcional)"
        value={comment}
        disabled={saving}
        onChange={(input) => {
          setComment(input.target.value);
          setSaved(false);
        }}
      />
      {notice && <p className="feedback-notice" role="status">{notice}</p>}
      <button
        className="primary-button"
        disabled={saving || !rating || saved}
        onClick={() => void submit()}
      >
        {saving ? "Enviando…" : saved ? "Opinión registrada ✓" : "Enviar calificación"}
      </button>
    </section>
  );
}
