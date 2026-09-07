#!/usr/bin/env python3
"""Difusión de sala con datos: el SSE envía el contenido nuevo en lugar de un
aviso que obliga a cada cliente a pedir la sala entera. Ediciones ancladas."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
hechos = []

# --- 1) Canal SSE: usa el observador compartido -----------------------------
p = root / "app/api/public/events/[slug]/room/stream/route.ts"
s = p.read_text()
if "subscribeToRoom" not in s:
    def sub(pattern, repl, text):
        new, n = re.subn(pattern, repl, text, count=1, flags=re.S)
        if n != 1:
            print("ANCLA NO ENCONTRADA (stream):", pattern[:60]); sys.exit(1)
        return new
    s = sub(r'import \{ getRoomEmitter \} from "@/lib/room-events";',
            'import { subscribeToRoom } from "@/lib/room-stream";', s)
    s = sub(r'  const emitter = getRoomEmitter\(\);\n  const channel = `room:\$\{event\.id\}`;\n',
            '', s)
    s = sub(r'''      const send = \(kind: string\) => \{
        try \{
          controller\.enqueue\(encoder\.encode\(`data: \$\{kind\}\\n\\n`\)\);
        \} catch \{
          cleanup\(\);
        \}
      \};
      const heartbeat = setInterval\(\(\) => send\("heartbeat"\), 25_000\);
      const cleanup = \(\) => \{
        clearInterval\(heartbeat\);
        emitter\.off\(channel, send\);
      \};
      emitter\.on\(channel, send\);''',
            lambda _m: '''      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\\n\\n`));
        } catch {
          cleanup();
        }
      };
      const heartbeat = setInterval(() => send("heartbeat"), 25_000);
      const unsubscribe = subscribeToRoom(event.id, send);
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };''', s)
    p.write_text(s); hechos.append("canal SSE")

# --- 2) Las acciones avisan al observador local -----------------------------
p = root / "app/api/public/events/[slug]/room/route.ts"
s = p.read_text()
if "nudgeRoom" not in s:
    s2, n = re.subn(r'import \{ notifyRoomActivity \} from "@/lib/room-events";',
                    'import { notifyRoomActivity } from "@/lib/room-events";\nimport { nudgeRoom } from "@/lib/room-stream";', s, count=1)
    if n != 1:
        print("ANCLA NO ENCONTRADA (room route): import"); sys.exit(1)
    s2, n = re.subn(r'notifyRoomActivity\((access\.eventId), "([a-z_]+)"\);',
                    r'notifyRoomActivity(\1, "\2");\n    nudgeRoom(\1);', s2)
    if n == 0:
        print("ANCLA NO ENCONTRADA (room route): notifyRoomActivity"); sys.exit(1)
    p.write_text(s2); hechos.append(f"avisos ({n})")

# --- 3) Cliente: aplica los datos recibidos ---------------------------------
p = root / "app/room/[slug]/room-client.tsx"
s = p.read_text()
if "applyStreamPayload" not in s:
    old = re.search(r'    let pollMs = 2_000;.*?    schedule\(\);\n', s, flags=re.S)
    if not old:
        print("ANCLA NO ENCONTRADA (cliente): bloque de sondeo"); sys.exit(1)
    nuevo = '''    // El canal SSE entrega el contenido nuevo ya resuelto, así que el sondeo
    // completo queda como respaldo espaciado en lugar de dispararse con cada
    // mensaje: con miles de asistentes eso provocaba una avalancha.
    let pollMs = 60_000;
    const streamUrl = accessToken
      ? `/api/public/events/${eventShell.slug}/room/stream?access=${encodeURIComponent(accessToken)}`
      : `/api/public/events/${eventShell.slug}/room/stream`;
    const source = new EventSource(streamUrl);
    source.onopen = () => {
      pollMs = 60_000;
    };
    source.onerror = () => {
      pollMs = 8_000;
    };
    const applyStreamPayload = (raw: string) => {
      if (raw === "heartbeat" || raw === "connected") return;
      let payload: { type?: string; messages?: RoomData["messages"]; reactions?: RoomData["reactions"] };
      try {
        payload = JSON.parse(raw);
      } catch {
        void refresh();
        return;
      }
      if (payload.type === "chat" && payload.messages?.length) {
        setRoom((current) => {
          if (!current) return current;
          const known = new Set(current.messages.map((item) => item.id));
          const fresh = payload.messages!.filter((item) => !known.has(item.id));
          if (!fresh.length) return current;
          return { ...current, messages: [...fresh, ...current.messages].slice(0, 100) };
        });
        return;
      }
      if (payload.type === "reactions" && payload.reactions) {
        setRoom((current) => (current ? { ...current, reactions: payload.reactions! } : current));
        return;
      }
      void refresh();
    };
    source.onmessage = (message) => applyStreamPayload(message.data);
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        void refresh().finally(schedule);
      }, pollMs);
    };
    schedule();
'''
    s = s[:old.start()] + nuevo + s[old.end():]
    p.write_text(s); hechos.append("cliente")

print("ok:", ", ".join(hechos) if hechos else "ya aplicado")
