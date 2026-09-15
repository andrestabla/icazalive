"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_ROOM_MODULES,
  ROOM_MODULE_KEYS,
  ROOM_MODULE_LABELS,
  type RoomModuleKey,
  type RoomModules,
} from "@/lib/room-modules";
import "../room-modules.css";

// Interruptores de los módulos de la sala. Cada cambio se guarda de inmediato
// y llega a los participantes conectados por SSE, así que sirve tanto para
// configurar el evento como para encender o apagar un módulo en plena
// transmisión. Se usa en la pestaña Interacción y, en modo compacto, en la
// sala técnica.
export default function RoomModulesPanel({
  slug,
  initial,
  compact = false,
  onChange,
}: {
  slug: string;
  initial?: Partial<RoomModules> | null;
  compact?: boolean;
  onChange?: (modules: RoomModules) => void;
}) {
  const [modules, setModules] = useState<RoomModules>({ ...DEFAULT_ROOM_MODULES, ...(initial ?? {}) });
  const [loaded, setLoaded] = useState(Boolean(initial));
  const [saving, setSaving] = useState<RoomModuleKey | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetch(`/api/events/${slug}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { roomModules?: Partial<RoomModules> } } | null) => {
        if (cancelled) return;
        if (payload?.data?.roomModules) {
          setModules({ ...DEFAULT_ROOM_MODULES, ...payload.data.roomModules });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [slug, initial]);

  const toggle = async (key: RoomModuleKey) => {
    const next = { ...modules, [key]: !modules[key] };
    setModules(next);
    setSaving(key);
    setNotice(null);
    try {
      const response = await fetch(`/api/events/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomModules: { [key]: next[key] } }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setModules(modules);
        setNotice({ text: payload.error ?? "No fue posible guardar el cambio.", error: true });
      } else {
        onChange?.(next);
        setNotice({
          text: `${ROOM_MODULE_LABELS[key].title} ${next[key] ? "activado" : "desactivado"}. Los participantes lo ven al instante.`,
          error: false,
        });
      }
    } catch {
      setModules(modules);
      setNotice({ text: "No fue posible contactar al servidor.", error: true });
    } finally {
      setSaving(null);
    }
  };

  const activeCount = ROOM_MODULE_KEYS.filter((key) => modules[key]).length;

  return (
    <section className={`room-modules${compact ? " compact" : ""}`} aria-label="Módulos de la sala">
      <header>
        <div>
          <p className="eyebrow">MÓDULOS DE LA SALA</p>
          {!compact && <h3>Qué verán los participantes</h3>}
          <p>
            {compact
              ? `${activeCount} de ${ROOM_MODULE_KEYS.length} activos. Puedes cambiarlos durante la transmisión.`
              : "Activa solo lo que este evento necesita. Puedes encender o apagar cualquier módulo durante la transmisión y la sala se actualiza al instante."}
          </p>
        </div>
      </header>
      <div className="room-modules-grid">
        {ROOM_MODULE_KEYS.map((key) => (
          <label className={`room-module${modules[key] ? " on" : ""}`} key={key}>
            <b>{ROOM_MODULE_LABELS[key].title}</b>
            <input
              type="checkbox"
              role="switch"
              aria-checked={modules[key]}
              checked={modules[key]}
              disabled={!loaded || saving !== null}
              onChange={() => void toggle(key)}
            />
            <small>{ROOM_MODULE_LABELS[key].description}</small>
          </label>
        ))}
      </div>
      {notice && (
        <p className={`room-modules-status ${notice.error ? "error" : "ok"}`} role="status">
          {notice.error ? "⚠ " : "✓ "}
          {notice.text}
        </p>
      )}
    </section>
  );
}
