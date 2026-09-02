"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Asset = { id: string; title: string; s3Key: string; durationSeconds: number | null };
type ContentConfig = {
  contentAssetId: string | null;
  simulatedDelivery: "direct" | "streaming";
  hybridSwitchOffsetMinutes: number | null;
};
type EmitterState = { status: string; ecsConfigured: boolean; startedAt: string | null };

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

// Panel de contenido simulado: el video se elige de la biblioteca (Contenidos)
// y se entrega siempre vía Amazon IVS. La emisión arranca sola a la hora del
// evento; los controles manuales sirven para pruebas o contingencias.
export default function SimulatedContentPanel({
  eventSlug,
  isHybrid,
  postEventRedirectUrl = null,
  onRedirectChange,
}: {
  eventSlug: string;
  isHybrid: boolean;
  postEventRedirectUrl?: string | null;
  onRedirectChange?: (value: string | null) => void;
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
          simulatedDelivery: "streaming",
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
        text: action === "start" ? "Emisión iniciada. La señal aparece en la sala en segundos." : "Emisión detenida.",
        error: false,
      });
      setRefreshKey((v) => v + 1);
    } else {
      setStatus({ text: payload.error ?? "No fue posible completar la acción.", error: true });
    }
    setBusy(false);
  };

  const running = emitter?.status === "running";
  const selected = assets.find((asset) => asset.id === config?.contentAssetId) ?? null;

  return (
    <section className="panel recorded-video-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CONTENIDO SIMULADO</p>
          <h2>Contenido y emisión</h2>
          <p>
            El video se elige de la biblioteca y se emite por Amazon IVS con
            calidad adaptativa: la audiencia lo vive como una transmisión en vivo.
            La emisión arranca sola a la hora del evento
            {isHybrid ? " (o en el minuto de transición)" : ""} y termina al final.
          </p>
        </div>
        <Link href="/content" className="secondary-action link-button">
          Gestionar biblioteca
        </Link>
      </div>

      <div className="recorded-video-body">
        <label className="post-registration-field">
          Contenido de la biblioteca
          <div>
            <select
              value={config?.contentAssetId ?? ""}
              disabled={busy || running}
              onChange={(e) => void saveConfig({ contentAssetId: e.target.value || null })}
            >
              <option value="">Selecciona un contenido…</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}{asset.durationSeconds ? ` · ${formatDuration(asset.durationSeconds)}` : ""}
                </option>
              ))}
            </select>
          </div>
          <small>
            {assets.length === 0 ? (
              <>La biblioteca está vacía. Sube y procesa el video en <Link href="/content">Contenidos</Link> y vuelve aquí para seleccionarlo.</>
            ) : selected ? (
              <>Seleccionado: <b>{selected.title}</b>{selected.durationSeconds ? ` (${formatDuration(selected.durationSeconds)})` : ""}. Los videos se cargan y procesan en Contenidos; aquí solo se asignan.</>
            ) : (
              <>Los videos se cargan y procesan en Contenidos; aquí solo se asignan al evento.</>
            )}
          </small>
        </label>

        <div className="sim-delivery-fixed">
          <span className="service-logo ivs">IVS</span>
          <div>
            <b>Entrega por Amazon IVS</b>
            <small>Streaming con bitrate adaptativo y baja latencia, igual que un evento en vivo.</small>
          </div>
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
                  void saveConfig({ hybridSwitchOffsetMinutes: value ? Number(value) : null });
                }}
              />
            </div>
            <small>Minutos desde el inicio del evento. Vacío = el contenido arranca con el evento.</small>
          </label>
        )}

        {onRedirectChange && (
          <label className="post-registration-field">
            Redirección al terminar el evento (opcional)
            <div>
              <input
                type="url"
                placeholder="https://tusitio.com/siguiente-paso"
                defaultValue={postEventRedirectUrl ?? ""}
                disabled={busy}
                onBlur={(e) => onRedirectChange(e.target.value.trim() || null)}
              />
            </div>
            <small>Al finalizar el contenido, la sala ofrece esta URL a los asistentes.</small>
          </label>
        )}

        <div className="sim-emitter">
          {!emitter?.ecsConfigured ? (
            <p className="recorded-video-status error">
              El emisor S3→IVS no está configurado en el servidor (AWS_ECS_*).
            </p>
          ) : (
            <div className="sim-emitter-controls">
              <span className={`sim-emitter-badge ${running ? "live" : ""}`}>
                {running ? "● EMITIENDO" : "○ En espera · arranca a la hora del evento"}
              </span>
              {running ? (
                <button className="content-remove" disabled={busy} onClick={() => void emitterAction("stop")}>
                  Detener emisión
                </button>
              ) : (
                <button
                  className="secondary-action"
                  disabled={busy || !config?.contentAssetId}
                  onClick={() => void emitterAction("start")}
                  title="Solo para pruebas o contingencias: la emisión arranca sola a la hora del evento"
                >
                  Iniciar ahora (prueba)
                </button>
              )}
            </div>
          )}
        </div>

        {status && (
          <p className={`recorded-video-status ${status.error ? "error" : ""}`} role="status">
            {status.text}
          </p>
        )}
      </div>
    </section>
  );
}
