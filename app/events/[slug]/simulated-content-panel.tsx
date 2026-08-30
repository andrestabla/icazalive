"use client";

import { useEffect, useState } from "react";

type Asset = { id: string; title: string; s3Key: string; durationSeconds: number | null };
type ContentConfig = {
  contentAssetId: string | null;
  simulatedDelivery: "direct" | "streaming";
  hybridSwitchOffsetMinutes: number | null;
};
type EmitterState = { status: string; ecsConfigured: boolean; startedAt: string | null };

// Panel de contenido simulado: elige el video de la biblioteca, el modo de
// distribución (S3 directo o S3→IVS) y, en modo streaming, controla el emisor.
export default function SimulatedContentPanel({
  eventSlug,
  isHybrid,
}: {
  eventSlug: string;
  isHybrid: boolean;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [config, setConfig] = useState<ContentConfig | null>(null);
  const [emitter, setEmitter] = useState<EmitterState | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [libRes, cfgRes, emRes] = await Promise.all([
        fetch("/api/content-assets", { cache: "no-store" }),
        fetch(`/api/events/${eventSlug}`, { cache: "no-store" }),
        fetch(`/api/events/${eventSlug}/emitter`, { cache: "no-store" }),
      ]);
      const lib = (await libRes.json().catch(() => null)) as { data?: { assets: Asset[] } } | null;
      const cfg = (await cfgRes.json().catch(() => null)) as {
        data?: { event?: ContentConfig } & Partial<ContentConfig>;
      } | null;
      const em = (await emRes.json().catch(() => null)) as { data?: EmitterState } | null;
      if (cancelled) return;
      if (lib?.data) setAssets(lib.data.assets);
      const c = cfg?.data?.event ?? cfg?.data;
      if (c) {
        setConfig({
          contentAssetId: c.contentAssetId ?? null,
          simulatedDelivery: (c.simulatedDelivery as "direct" | "streaming") ?? "direct",
          hybridSwitchOffsetMinutes: c.hybridSwitchOffsetMinutes ?? null,
        });
      }
      if (em?.data) setEmitter(em.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventSlug, refreshKey]);

  const saveConfig = async (patch: Partial<ContentConfig>) => {
    setBusy(true);
    const response = await fetch(`/api/events/${eventSlug}/content`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await response.json()) as { data?: ContentConfig; error?: string };
    if (response.ok && payload.data) {
      setConfig(payload.data);
      setStatus({ text: "Configuración guardada.", error: false });
    } else {
      setStatus({ text: payload.error ?? "No fue posible guardar.", error: true });
    }
    setBusy(false);
  };

  const emitterAction = async (action: "start" | "stop") => {
    setBusy(true);
    setStatus({ text: action === "start" ? "Iniciando emisión…" : "Deteniendo…", error: false });
    const response = await fetch(`/api/events/${eventSlug}/emitter`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json()) as { data?: { status: string }; error?: string };
    if (response.ok) {
      setStatus({
        text: action === "start" ? "Emisión iniciada. La señal aparecerá en la sala en segundos." : "Emisión detenida.",
        error: false,
      });
      setRefreshKey((v) => v + 1);
    } else {
      setStatus({ text: payload.error ?? "No fue posible completar la acción.", error: true });
    }
    setBusy(false);
  };

  const delivery = config?.simulatedDelivery ?? "direct";
  const running = emitter?.status === "running";

  return (
    <section className="panel recorded-video-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CONTENIDO SIMULADO</p>
          <h2>Fuente y distribución</h2>
          <p>
            Elige el contenido de la biblioteca y cómo se entrega: desde S3
            (económico) o vía Amazon IVS con bitrate adaptativo para audiencias
            grandes.
          </p>
        </div>
      </div>

      <div className="recorded-video-body">
        <label className="post-registration-field">
          Contenido de la biblioteca
          <div>
            <select
              value={config?.contentAssetId ?? ""}
              disabled={busy}
              onChange={(e) => void saveConfig({ contentAssetId: e.target.value || null })}
            >
              <option value="">— Usar el video subido a este evento —</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}
                </option>
              ))}
            </select>
          </div>
          <small>
            Si no eliges de la biblioteca, se usa el MP4 subido en el panel de
            arriba.
          </small>
        </label>

        <div className="sim-delivery-toggle">
          <button
            className={delivery === "direct" ? "active" : ""}
            disabled={busy || running}
            onClick={() => void saveConfig({ simulatedDelivery: "direct" })}
          >
            <b>Simulado directo</b>
            <small>Desde S3 con reloj compartido. Económico.</small>
          </button>
          <button
            className={delivery === "streaming" ? "active" : ""}
            disabled={busy || running}
            onClick={() => void saveConfig({ simulatedDelivery: "streaming" })}
          >
            <b>Simulado en streaming</b>
            <small>S3 → IVS con calidad adaptativa. Para audiencias grandes.</small>
          </button>
        </div>

        {isHybrid && (
          <label className="post-registration-field">
            Transición híbrida: minuto en que Zoom cede el paso al contenido
            <div>
              <input
                type="number"
                min={0}
                placeholder="Ej. 30"
                defaultValue={config?.hybridSwitchOffsetMinutes ?? ""}
                disabled={busy}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  void saveConfig({
                    hybridSwitchOffsetMinutes: value ? Number(value) : null,
                  });
                }}
              />
            </div>
            <small>
              Minutos desde el inicio del evento. Vacío = sin transición
              automática.
            </small>
          </label>
        )}

        {delivery === "streaming" && (
          <div className="sim-emitter">
            {!emitter?.ecsConfigured ? (
              <p className="recorded-video-status error">
                El emisor S3→IVS no está configurado en el servidor
                (AWS_ECS_*). Guarda las variables para habilitarlo.
              </p>
            ) : (
              <div className="sim-emitter-controls">
                <span className={`sim-emitter-badge ${running ? "live" : ""}`}>
                  {running ? "● EMITIENDO" : "○ Detenido"}
                </span>
                {running ? (
                  <button
                    className="content-remove"
                    disabled={busy}
                    onClick={() => void emitterAction("stop")}
                  >
                    Detener emisión
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => void emitterAction("start")}
                  >
                    Iniciar emisión simulada
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {status && (
          <p className={`recorded-video-status ${status.error ? "error" : ""}`} role="status">
            {status.text}
          </p>
        )}
      </div>
    </section>
  );
}
