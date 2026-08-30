"use client";

import { useEffect, useRef, useState } from "react";

type PlayerState = "connecting" | "live" | "waiting" | "error";

// Reproductor de la señal de Amazon IVS dentro de la sala. Safari reproduce
// HLS de forma nativa; el resto de navegadores carga hls.js bajo demanda para
// no añadir peso al resto de la sala.
export default function IvsPlayer({ playbackUrl }: { playbackUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [state, setState] = useState<PlayerState>("connecting");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    const onPlaying = () => setState("live");
    video.addEventListener("playing", onPlaying);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
      video.play().catch(() => setState("waiting"));
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            setState("error");
            return;
          }
          const instance = new Hls({
            liveSyncDurationCount: 3,
            maxBufferLength: 12,
          });
          hls = instance;
          instance.attachMedia(video);
          instance.loadSource(playbackUrl);
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Mientras el canal no recibe señal, IVS responde 404: se
              // reintenta en lugar de romper la sala.
              setState("waiting");
              window.setTimeout(() => instance.startLoad(), 4000);
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              instance.recoverMediaError();
            } else {
              setState("error");
            }
          });
        })
        .catch(() => {
          if (!cancelled) setState("error");
        });
    }

    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [playbackUrl]);

  const label =
    state === "live"
      ? "Señal en vivo desde Amazon IVS"
      : state === "waiting"
        ? "Esperando la señal del organizador"
        : state === "error"
          ? "No fue posible iniciar el reproductor"
          : "Conectando con la señal";

  return (
    <div className="simulated-player">
      <video ref={videoRef} muted={muted} autoPlay playsInline controls={false} />
      <div className="simulated-player-bar">
        <button type="button" onClick={() => setMuted((value) => !value)}>
          {muted ? "🔇 Activar sonido" : "🔊 Silenciar"}
        </button>
        <span className={state === "live" ? "in-sync" : "off-sync"}>
          {state === "live" ? "● " : "◌ "}
          {label}
        </span>
      </div>
    </div>
  );
}
