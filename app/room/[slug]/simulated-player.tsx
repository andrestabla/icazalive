"use client";

import { useEffect, useRef, useState } from "react";

const MAX_DRIFT_SECONDS = 2;

export type SimulatedPlayback = {
  durationSeconds: number;
  startsAt: string;
  endsAt: string;
  ended: boolean;
  postEventRedirectUrl: string | null;
};

// Reproductor con reloj compartido: todas las personas ven el mismo instante
// del video. La posición esperada se calcula contra la hora del servidor y se
// corrige automáticamente cuando la desviación supera los 2 segundos.
export default function SimulatedPlayer({
  eventSlug,
  accessToken,
  playback,
  serverTime,
  isParticipant,
}: {
  eventSlug: string;
  accessToken: string | null;
  playback: SimulatedPlayback;
  serverTime: string;
  isParticipant: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Diferencia entre el reloj del servidor y el del navegador, medida al montar.
  const serverDeltaRef = useRef<number | null>(null);
  const [muted, setMuted] = useState(true);
  const [drift, setDrift] = useState(0);
  const [corrections, setCorrections] = useState(0);
  const [redirectSeconds, setRedirectSeconds] = useState(10);
  const [ended, setEnded] = useState(playback.ended);

  const expectedPosition = () => {
    const serverNow = Date.now() + (serverDeltaRef.current ?? 0);
    return (serverNow - new Date(playback.startsAt).getTime()) / 1000;
  };

  useEffect(() => {
    serverDeltaRef.current ??= new Date(serverTime).getTime() - Date.now();
    const video = videoRef.current;
    if (!video || ended) return;

    const synchronize = (force: boolean) => {
      const expected = expectedPosition();
      if (expected >= playback.durationSeconds) {
        setEnded(true);
        return;
      }
      if (expected < 0) return;
      const difference = video.currentTime - expected;
      setDrift(difference);
      if (force || Math.abs(difference) > MAX_DRIFT_SECONDS) {
        video.currentTime = Math.max(0, expected);
        if (!force) setCorrections((count) => count + 1);
      }
      if (video.paused) {
        void video.play().catch(() => undefined);
      }
    };

    const onLoaded = () => synchronize(true);
    // El asistente no controla la línea de tiempo: cualquier salto se corrige.
    const onSeeking = () => {
      const expected = expectedPosition();
      if (Math.abs(video.currentTime - expected) > MAX_DRIFT_SECONDS) {
        video.currentTime = Math.max(0, Math.min(expected, playback.durationSeconds));
      }
    };
    const onPause = () => {
      if (expectedPosition() < playback.durationSeconds) {
        void video.play().catch(() => undefined);
      }
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("pause", onPause);
    const interval = window.setInterval(() => synchronize(false), 3_000);
    synchronize(true);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("pause", onPause);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, playback.durationSeconds, playback.startsAt]);

  useEffect(() => {
    if (!ended || !playback.postEventRedirectUrl || !isParticipant) return;
    const interval = window.setInterval(() => {
      setRedirectSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(interval);
          window.location.href = playback.postEventRedirectUrl!;
          return 0;
        }
        return seconds - 1;
      });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [ended, playback.postEventRedirectUrl, isParticipant]);

  if (ended) {
    return (
      <div className="room-video-ready simulated-ended">
        <span>✓</span>
        <h2>El evento finalizó</h2>
        <p>Gracias por acompañarnos. La transmisión pregrabada terminó.</p>
        {playback.postEventRedirectUrl && (
          <a href={playback.postEventRedirectUrl}>
            {isParticipant && redirectSeconds > 0
              ? `Te llevaremos a la página del organizador en ${redirectSeconds} s ↗`
              : "Continuar hacia la página del organizador ↗"}
          </a>
        )}
      </div>
    );
  }

  const source = accessToken
    ? `/api/public/events/${eventSlug}/video?access=${encodeURIComponent(accessToken)}`
    : `/api/public/events/${eventSlug}/video`;

  return (
    <div className="simulated-player">
      <video
        ref={videoRef}
        src={source}
        autoPlay
        muted={muted}
        playsInline
        controls={false}
      />
      <div className="simulated-player-bar">
        <button onClick={() => setMuted((value) => !value)}>
          {muted ? "🔇 Activar sonido" : "🔊 Silenciar"}
        </button>
        <span className={Math.abs(drift) <= MAX_DRIFT_SECONDS ? "in-sync" : "off-sync"}>
          ● Transmisión sincronizada · desviación {Math.abs(drift).toFixed(1)} s
          {corrections > 0 ? ` · ${corrections} ajuste${corrections === 1 ? "" : "s"}` : ""}
        </span>
      </div>
    </div>
  );
}
