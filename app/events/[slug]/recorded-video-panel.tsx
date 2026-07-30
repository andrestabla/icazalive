"use client";

import { useEffect, useState } from "react";

type VideoInfo = {
  hasVideo: boolean;
  name: string | null;
  size: number | null;
  durationSeconds: number | null;
  uploadedAt: string | null;
  postEventRedirectUrl: string | null;
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "duración desconocida";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} min ${rest.toString().padStart(2, "0")} s`;
}

// Lee la duración del MP4 en el navegador antes de subirlo.
function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const element = document.createElement("video");
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      URL.revokeObjectURL(element.src);
      resolve(Number.isFinite(element.duration) ? element.duration : null);
    };
    element.onerror = () => {
      URL.revokeObjectURL(element.src);
      resolve(null);
    };
    element.src = URL.createObjectURL(file);
  });
}

export default function RecordedVideoPanel({
  eventSlug,
  postEventRedirectUrl,
  saving,
  onRedirectChange,
}: {
  eventSlug: string;
  postEventRedirectUrl: string | null;
  saving: boolean;
  onRedirectChange: (value: string | null) => void;
}) {
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventSlug}/video`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: VideoInfo } | null) => {
        if (!cancelled && payload?.data) setInfo(payload.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventSlug, refreshKey]);

  const upload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".mp4") && file.type !== "video/mp4") {
      setStatus({ text: "Selecciona un archivo MP4.", error: true });
      return;
    }
    setUploading(true);
    setStatus({ text: `Subiendo ${file.name}…`, error: false });
    const duration = await readVideoDuration(file);
    const query = new URLSearchParams({ name: file.name });
    if (duration) query.set("duration", String(duration));
    const response = await fetch(
      `/api/events/${eventSlug}/video?${query.toString()}`,
      { method: "PUT", body: file },
    );
    const payload = (await response.json()) as { error?: string };
    if (response.ok) {
      setStatus({
        text: "Video cargado. La sala lo reproducirá automáticamente a la hora de inicio.",
        error: false,
      });
      setRefreshKey((current) => current + 1);
    } else {
      setStatus({
        text: payload.error ?? "No fue posible subir el video.",
        error: true,
      });
    }
    setUploading(false);
  };

  const removeVideo = async () => {
    setUploading(true);
    setStatus(null);
    const response = await fetch(`/api/events/${eventSlug}/video`, {
      method: "DELETE",
    });
    if (response.ok) {
      setStatus({ text: "El video fue eliminado.", error: false });
      setRefreshKey((current) => current + 1);
    } else {
      const payload = (await response.json()) as { error?: string };
      setStatus({ text: payload.error ?? "No fue posible eliminar.", error: true });
    }
    setUploading(false);
  };

  return (
    <section className="panel recorded-video-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">EVENTO SIMULADO</p>
          <h2>Video pregrabado</h2>
          <p>
            La reproducción inicia sola a la hora del evento con reloj compartido:
            todas las personas ven el mismo instante y la sala se completa al terminar.
          </p>
        </div>
      </div>
      <div className="recorded-video-body">
        {info?.hasVideo ? (
          <div className="recorded-video-current">
            <span>▶</span>
            <div>
              <b>{info.name ?? "video.mp4"}</b>
              <small>
                {formatSize(info.size)} · {formatDuration(info.durationSeconds)}
                {info.uploadedAt
                  ? ` · cargado ${new Date(info.uploadedAt).toLocaleDateString("es-CO")}`
                  : ""}
              </small>
            </div>
            <button disabled={uploading} onClick={() => void removeVideo()}>
              Eliminar
            </button>
          </div>
        ) : (
          <div className="recorded-video-upload">
            <input
              type="file"
              accept="video/mp4,.mp4"
              disabled={uploading}
              aria-label="Subir video MP4"
              onChange={(input) => {
                const file = input.target.files?.[0];
                if (file) void upload(file);
                input.target.value = "";
              }}
            />
            <small>
              MP4 de hasta 1 GB. El archivo se guarda en este equipo
              (~/.icaza-live/media), fuera de la carpeta sincronizada.
            </small>
          </div>
        )}
        {status && (
          <p className={`recorded-video-status ${status.error ? "error" : ""}`} role="status">
            {status.text}
          </p>
        )}
        <label className="post-registration-field">
          Redirección al terminar el evento (opcional)
          <div>
            <input
              type="url"
              placeholder="https://tusitio.com/siguiente-paso"
              maxLength={500}
              defaultValue={postEventRedirectUrl ?? ""}
              disabled={saving}
              onBlur={(input) => {
                const value = input.target.value.trim();
                if ((postEventRedirectUrl ?? "") !== value) {
                  onRedirectChange(value || null);
                }
              }}
            />
          </div>
          <small>Al finalizar el video, la sala ofrece esta URL y redirige a los asistentes.</small>
        </label>
      </div>
    </section>
  );
}
