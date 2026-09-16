#!/usr/bin/env python3
"""Lote 3 de septiembre: cierre de la sala con mensaje editable, cierre desde
la sala técnica, línea de tiempo del contenido simulado, aviso SSE de cambio
de estado, y sin widget de ayuda en la sala. Anclado e idempotente.
(lib/room-modules.ts y room-modules-panel.tsx se copian completos.)"""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def patch(rel, pairs, marker):
    p = root / rel; s = p.read_text(encoding="utf-8")
    if marker in s: print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if old not in s: print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8"); print(f"OK {rel}: aplicado")

def append_css(rel, marker, css):
    p = root / rel; s = p.read_text(encoding="utf-8")
    if marker in s: print(f"OK {rel}: css ya presente"); return
    p.write_text(s.rstrip("\n") + "\n" + css, encoding="utf-8"); print(f"OK {rel}: css añadido")

# 1. Eventos PATCH: acepta closingMessage dentro de roomModules
patch("app/api/events/[slug]/route.ts", [
    ('    roomModules?: Partial<Record<"chat" | "questions" | "polls" | "resources" | "reactions", boolean>>;',
     '    roomModules?: Partial<Record<"chat" | "questions" | "polls" | "resources" | "reactions", boolean>> & { closingMessage?: string };'),
], "closingMessage?: string };")

# 2. SSE: aviso de cambio de estado del evento (en vivo / completado)
patch("lib/room-stream.ts", [
    ("  modulesSignature: string | null;\n  running: boolean;\n};",
     "  modulesSignature: string | null;\n  statusSignature: string | null;\n  running: boolean;\n};"),
    ("      .select({ roomModules: events.roomModules })",
     "      .select({ roomModules: events.roomModules, status: events.status })"),
    ('''    if (eventRow) {
      const modules = normalizeRoomModules(eventRow.roomModules);''',
     '''    if (eventRow) {
      // Estado del evento: al pasar a EN VIVO o completarse, todos los
      // asistentes recargan la sala al instante (reproductor o cierre).
      if (watcher.statusSignature === null) {
        watcher.statusSignature = eventRow.status;
      } else if (eventRow.status !== watcher.statusSignature) {
        watcher.statusSignature = eventRow.status;
        broadcast(watcher, { type: "refresh", reason: "status" });
      }
      const modules = normalizeRoomModules(eventRow.roomModules);'''),
    ("      modulesSignature: null,\n      running: false,",
     "      modulesSignature: null,\n      statusSignature: null,\n      running: false,"),
], "statusSignature")

# 3. Sala del participante: pantalla de cierre y sin interacción al completar
patch("app/room/[slug]/room-client.tsx", [
    ("  modules?: { chat: boolean; questions: boolean; polls: boolean; resources: boolean; reactions: boolean };",
     "  modules?: { chat: boolean; questions: boolean; polls: boolean; resources: boolean; reactions: boolean; closingMessage?: string };"),
    ('''  const canParticipate =
    room.viewer.kind === "participant" && !room.moderation.blocked && !muted;''',
     '''  const isCompleted = room.event.status === "completed";
  const canParticipate =
    room.viewer.kind === "participant" && !room.moderation.blocked && !muted && !isCompleted;'''),
    ('''            ) : (
              <div className="room-lobby">
                <span>◷</span>
                <p className="eyebrow">LA SALA ABRIRÁ PRONTO</p>''',
     '''            ) : isCompleted ? (
              <div className="room-lobby room-closed">
                <span>✓</span>
                <p className="eyebrow">EVENTO FINALIZADO</p>
                <h1>{room.event.title}</h1>
                <p className="room-closed-message">{room.modules?.closingMessage?.trim() || "Gracias por su asistencia, pronto los contactaremos."}</p>
                <small>La sala está cerrada.</small>
              </div>
            ) : (
              <div className="room-lobby">
                <span>◷</span>
                <p className="eyebrow">LA SALA ABRIRÁ PRONTO</p>'''),
    ('''              <span className={isLive ? "live" : ""}>● {isLive ? "EN VIVO" : technicalTest ? "PRUEBA TÉCNICA · sin emisión pública" : "LOBBY"}</span>''',
     '''              <span className={isLive ? "live" : ""}>● {isLive ? "EN VIVO" : technicalTest ? "PRUEBA TÉCNICA · sin emisión pública" : isCompleted ? "FINALIZADO" : "LOBBY"}</span>'''),
], "room-closed")

# El reproductor simulado (modo video grabado) no debe mostrarse tras el cierre.
rc = root / "app/room/[slug]/room-client.tsx"; s = rc.read_text(encoding="utf-8")
old = '''            {room.simulatedPlayback &&
            (room.simulatedPlayback.ended ||
              (isLive && minutesUntilStart === 0)) ? ('''
new = '''            {!isCompleted && room.simulatedPlayback &&
            (room.simulatedPlayback.ended ||
              (isLive && minutesUntilStart === 0)) ? ('''
if old in s:
    s = s.replace(old, new, 1); rc.write_text(s, encoding="utf-8"); print("OK room-client: simulatedPlayback tras cierre")
elif new in s:
    print("OK room-client: simulatedPlayback ya aplicado")
else:
    print("AVISO room-client: bloque simulatedPlayback no encontrado (se omite)")

append_css("app/room/[slug]/room-modules.css", ".room-closed", """
/* Evento finalizado: la sala queda cerrada con el mensaje del organizador. */
.room-closed > span { background: #1f8f5f33 !important; color: #8fe0b5 !important; }
.room-closed-message { max-width: 560px; margin: 8px auto 0; font-size: 19px; line-height: 1.5; color: #f3f1f8; }
.room-closed > small { display: block; margin-top: 18px; color: #a9a4b8; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
""")

# 4. Panel de módulos: estilos del mensaje de cierre
append_css("app/events/room-modules.css", ".room-closing-message", """
/* Mensaje de cierre del evento. */
.room-closing-message { margin-top: 14px; padding-top: 12px; border-top: 1px solid #ebe7f1; display: grid; gap: 8px; }
.room-closing-message label { display: grid; gap: 4px; }
.room-closing-message label b { font-size: 13px; }
.room-closing-message label small { color: #8e8998; font-size: 11px; }
.room-closing-message textarea { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 9px 11px; border: 1px solid #d9d5e0; border-radius: 9px; font: inherit; font-size: 13px; resize: vertical; }
.room-closing-message button { justify-self: start; }
.room-modules.compact .room-closing-message textarea { background: #fff; color: #201c2b; }
""")

# 5. Emisor: duración del contenido y hora del servidor para la línea de tiempo
patch("app/api/events/[slug]/emitter/route.ts", [
    ('import { events, sessions } from "@/db/schema";', 'import { contentAssets, events, sessions } from "@/db/schema";'),
    ('''  return NextResponse.json({
    data: {
      status: liveState,
      signal,
      playbackUrl: session.playbackUrl,
      ecsConfigured: Boolean(ecs),
      contentConfigured: Boolean(resolved.event.contentAssetId),
      startedAt: session.emitterStartedAt,
    },
  });''',
     '''  // Duración del contenido asignado, para la línea de tiempo de la sala técnica.
  let durationSeconds: number | null = null;
  if (resolved.event.contentAssetId) {
    const [asset] = await getDb()
      .select({ durationSeconds: contentAssets.durationSeconds })
      .from(contentAssets)
      .where(eq(contentAssets.id, resolved.event.contentAssetId))
      .limit(1);
    durationSeconds = asset?.durationSeconds ?? null;
  }
  return NextResponse.json({
    data: {
      status: liveState,
      signal,
      playbackUrl: session.playbackUrl,
      ecsConfigured: Boolean(ecs),
      contentConfigured: Boolean(resolved.event.contentAssetId),
      startedAt: session.emitterStartedAt,
      durationSeconds,
      serverTime: new Date().toISOString(),
    },
  });'''),
], "durationSeconds")

# 6. Sala técnica: línea de tiempo + cerrar la sala
patch("app/events/[slug]/studio/studio-technical-test.tsx", [
    ('''  ecsConfigured: boolean;
  contentConfigured: boolean;
};''',
     '''  ecsConfigured: boolean;
  contentConfigured: boolean;
  startedAt?: string | null;
  durationSeconds?: number | null;
  serverTime?: string;
};

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}'''),
    ('''  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
''',
     '''  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  // Reloj local para la línea de tiempo (se corrige con la hora del servidor).
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (emitter.serverTime) setClockOffset(new Date(emitter.serverTime).getTime() - Date.now());
  }, [emitter.serverTime]);
  const [closing, setClosing] = useState(false);
  const closeRoom = async () => {
    if (!window.confirm("¿Cerrar la sala y finalizar el evento?\\n\\nSe detiene la emisión, los participantes verán el mensaje de cierre y el evento quedará completado. No se puede deshacer.")) return;
    setClosing(true);
    setNotice("");
    try {
      if (emitter.status === "running" || emitter.status === "starting") {
        await fetch(`/api/events/${event.slug}/emitter`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "stop" }) });
      }
      const response = await fetch(`/api/events/${event.slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(payload.error ?? "No fue posible cerrar la sala.");
        setClosing(false);
        return;
      }
      window.location.reload();
    } catch {
      setNotice("No fue posible contactar al servidor.");
      setClosing(false);
    }
  };
'''),
    ('''  const showPlayer = emitter.signal === "live" && Boolean(emitter.playbackUrl);
''',
     '''  const showPlayer = emitter.signal === "live" && Boolean(emitter.playbackUrl);
  const startedMs = emitter.startedAt ? new Date(emitter.startedAt).getTime() : null;
  const elapsed = startedMs !== null && running ? Math.max(0, (now + clockOffset - startedMs) / 1000) : null;
  const duration = emitter.durationSeconds ?? null;
  const showTimeline = simulated && running && elapsed !== null;
  const progress = showTimeline && duration ? Math.min(100, (elapsed / duration) * 100) : null;
'''),
    ('''      <div className="studio-stage-bottom">
        <span>◉ {event.title}</span>''',
     '''      {showTimeline && (
        <div className="studio-timeline" aria-label="Avance del contenido">
          <div className="studio-timeline-bar"><span style={{ width: `${progress ?? 0}%` }} /></div>
          <div className="studio-timeline-labels">
            <b>{formatClock(elapsed!)}{duration ? ` / ${formatClock(duration)}` : ""}</b>
            <small>
              {duration
                ? elapsed! >= duration
                  ? "El contenido terminó; el evento se completa solo."
                  : `Faltan ${formatClock(duration - elapsed!)} de contenido`
                : "Duración del contenido no disponible"}
            </small>
          </div>
        </div>
      )}
      <div className="studio-stage-bottom">
        <span>◉ {event.title}</span>'''),
    ('''          <Link href={`/room/${event.slug}`} target="_blank" className="secondary-action link-button">
            Ver como participante ↗
          </Link>''',
     '''          <Link href={`/room/${event.slug}`} target="_blank" className="secondary-action link-button">
            Ver como participante ↗
          </Link>
          {isPublic && (
            <button className="content-remove studio-close-room" disabled={busy || closing} onClick={() => void closeRoom()}>
              {closing ? "Cerrando…" : "Cerrar la sala"}
            </button>
          )}'''),
], "studio-timeline")

append_css("app/globals.css", ".studio-timeline", """
/* Sala técnica: línea de tiempo del contenido simulado y cierre de la sala. */
.studio-timeline { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; background: #ffffff0f; border: 1px solid #ffffff1a; }
.studio-timeline-bar { height: 6px; border-radius: 4px; background: #ffffff22; overflow: hidden; }
.studio-timeline-bar > span { display: block; height: 100%; background: linear-gradient(90deg, #8be0a4, #4fc27a); transition: width 1s linear; }
.studio-timeline-labels { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-top: 7px; flex-wrap: wrap; }
.studio-timeline-labels b { font-variant-numeric: tabular-nums; font-size: 14px; color: #fff; }
.studio-timeline-labels small { color: #c9c4d8; font-size: 11px; }
.studio-close-room { border-color: #ff8a9a !important; color: #ffb3bd !important; }
""")

# 7. Widget de ayuda: no aparece en la sala del participante
patch("app/components/help-widget.tsx", [
    ('''  const participantIntro: Record<HelpLocale, string> = {''',
     '''  // Durante el evento (sala del participante) no se muestra el widget.
  const inRoom = /^\\/room(\\/|$)/.test(pathname);
  const participantIntro: Record<HelpLocale, string> = {'''),
    ('''  return (
    <aside className="global-help-widget" aria-label={labels.title}>''',
     '''  if (inRoom) return null;

  return (
    <aside className="global-help-widget" aria-label={labels.title}>'''),
], "inRoom")

# 8. Sala cerrada: sin reacciones ni paneles de interacción
patch("app/room/[slug]/room-client.tsx", [
    ('  const enabledPanels = (["chat", "questions", "polls", "resources"] as const).filter((key) => roomModules[key]);',
     '  const enabledPanels = isCompleted ? [] : (["chat", "questions", "polls", "resources"] as const).filter((key) => roomModules[key]);'),
    ('          {roomModules.reactions && (', '          {roomModules.reactions && !isCompleted && ('),
], "isCompleted ? [] :")

# 9. Panel de módulos: lee el estado guardado (el GET del evento envuelve en data.event)
patch("app/events/[slug]/room-modules-panel.tsx", [('      .then((payload: { data?: { roomModules?: Partial<RoomModules> } } | null) => {\n        if (cancelled) return;\n        if (payload?.data?.roomModules) {\n          const merged = { ...DEFAULT_ROOM_MODULES, ...payload.data.roomModules };', '      .then((payload: { data?: { roomModules?: Partial<RoomModules>; event?: { roomModules?: Partial<RoomModules> } } } | null) => {\n        if (cancelled) return;\n        const saved = payload?.data?.event?.roomModules ?? payload?.data?.roomModules;\n        if (saved) {\n          const merged = { ...DEFAULT_ROOM_MODULES, ...saved };')], "payload?.data?.event?.roomModules")

# 10. Sala técnica: el escenario crece con los paneles (sin superposición)
append_css("app/globals.css", ".studio-stage.grow", """
/* Sala técnica: el escenario deja de tener alto fijo; el video conserva 16:9. */
.studio-stage { aspect-ratio: auto !important; min-height: 0 !important; height: auto !important; }
.studio-stage-empty { min-height: 300px; display: flex; flex-direction: column; justify-content: center; margin: 0 auto; }
.studio-stage.grow { display: block; }
""")

print("LISTO lote 3")
