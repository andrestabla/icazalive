#!/usr/bin/env python3
"""Módulos de la sala configurables (chat, preguntas, encuestas, recursos,
reacciones). Ediciones ancladas en archivos divergentes de Replit: schema,
sala del participante, API pública de la sala y pestaña Interacción."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def sub(text, pattern, repl, etiqueta, flags=re.S, count=1):
    new, n = re.subn(pattern, repl, text, count=count, flags=flags)
    if n < 1:
        print("ANCLA NO ENCONTRADA:", etiqueta); sys.exit(1)
    return new

# 1) schema
p = root / "db/schema.ts"; s = p.read_text()
if "roomModules" not in s:
    s = sub(s, r'(  feedbackEnabled: boolean\("feedback_enabled"\)[^\n]*\n)',
            lambda m: m.group(1) + '''  roomModules: jsonb("room_modules")
    .$type<{ chat: boolean; questions: boolean; polls: boolean; resources: boolean; reactions: boolean }>()
    .notNull()
    .default({ chat: true, questions: true, polls: true, resources: true, reactions: true }),
''', "schema feedbackEnabled")
    p.write_text(s); print("OK schema: room_modules")
else:
    print("OK schema: ya tenía room_modules")

# 2) API pública de la sala: módulos en GET y bloqueo en POST
p = root / "app/api/public/events/[slug]/room/route.ts"; s = p.read_text()
if "ROOM_ACTION_MODULE" not in s:
    s = sub(s, r'(import \{[^}]*NextResponse[^}]*\} from "next/server";\n)',
            lambda m: m.group(1) + 'import { ROOM_ACTION_MODULE, normalizeRoomModules } from "@/lib/room-modules";\n', "import")
    s = sub(s, r'(      attendeeCount: attendeeSummary\[0\]\?\.total \?\? 0,\n)',
            lambda m: m.group(1) + '      modules: normalizeRoomModules(record.event.roomModules),\n', "GET modules")
    s = sub(s, r'(    return NextResponse\.json\(\{ error: participationError \}, \{ status: 403 \}\);\n  \}\n)',
            lambda m: m.group(1) + '''
  // Módulos apagados por el organizador: la acción se rechaza aunque el
  // participante tenga una versión antigua de la sala abierta.
  const moduleKey = body.action ? ROOM_ACTION_MODULE[body.action] : undefined;
  if (moduleKey) {
    const [eventModules] = await db
      .select({ roomModules: events.roomModules })
      .from(events)
      .where(eq(events.id, access.eventId))
      .limit(1);
    if (eventModules && !normalizeRoomModules(eventModules.roomModules)[moduleKey]) {
      return NextResponse.json(
        { error: "Este módulo no está activo en este evento." },
        { status: 403 },
      );
    }
  }
''', "POST guard")
    if not re.search(r'import \{[^}]*\bevents\b[^}]*\} from "@/db/schema";', s, re.S):
        s = sub(s, r'import \{([^}]*)\} from "@/db/schema";', lambda m: 'import {' + m.group(1).rstrip() + ', events } from "@/db/schema";', "import events")
    p.write_text(s); print("OK room/route.ts: módulos")
else:
    print("OK room/route.ts: ya aplicado")

# 3) Sala del participante
p = root / "app/room/[slug]/room-client.tsx"; s = p.read_text()
if "roomModules" not in s:
    s = sub(s, r'(import "\./room-mobile\.css";\n)', lambda m: m.group(1) + 'import "./room-modules.css";\n', "import css")
    s = sub(s, r'(type RoomData = \{\n)', lambda m: m.group(1) + '  modules?: { chat: boolean; questions: boolean; polls: boolean; resources: boolean; reactions: boolean };\n', "tipo RoomData")
    s = sub(s, r'let payload: \{ type\?: string; messages\?: RoomData\["messages"\]; reactions\?: RoomData\["reactions"\] \};',
            lambda m: 'let payload: { type?: string; messages?: RoomData["messages"]; reactions?: RoomData["reactions"]; modules?: RoomData["modules"] };', "tipo payload")
    s = sub(s, r'(      if \(payload\.type === "reactions" && payload\.reactions\) \{)',
            lambda m: '''      if (payload.type === "modules" && payload.modules) {
        setRoom((current) => (current ? { ...current, modules: payload.modules! } : current));
        return;
      }
''' + m.group(1), "payload modules")
    s = sub(s, r'(\n  return \(\n    <main className="participant-room branded-room")',
            lambda m: '''
  // Módulos activos: el organizador puede apagarlos durante la transmisión.
  const roomModules = room.modules ?? { chat: true, questions: true, polls: true, resources: true, reactions: true };
  const enabledPanels = (["chat", "questions", "polls", "resources"] as const).filter((key) => roomModules[key]);
  const visiblePanel = enabledPanels.includes(activePanel) ? activePanel : enabledPanels[0] ?? null;
''' + m.group(1), "variables de módulos")
    s = sub(s, r'<main className="participant-room branded-room" style=\{brandStyle\}>',
            lambda m: '<main className={`participant-room branded-room${enabledPanels.length ? "" : " no-interaction"}`} style={brandStyle}>', "clase main")
    # barra de reacciones
    s = sub(s, r'(\n(\s*)<div className="room-reaction-bar"[^\n]*\n.*?\n\2</div>\n)',
            lambda m: '\n' + m.group(2) + '{roomModules.reactions && (' + m.group(1).rstrip('\n').replace('\n' + m.group(2), '\n' + m.group(2) + '  ') + '\n' + m.group(2) + ')}\n', "barra de reacciones")
    # pestañas
    for key in ["chat", "questions", "polls", "resources"]:
        s = sub(s, r'(\n(\s*))(<button className=\{activePanel === "' + key + r'" \? "active" : ""\} onClick=\{\(\) => setActivePanel\("' + key + r'"\)\}>[^\n]*</button>)',
                lambda m, key=key: m.group(1) + '{roomModules.' + key + ' && ' + m.group(3).replace('activePanel === "' + key + '"', 'visiblePanel === "' + key + '"') + '}', "pestaña " + key)
    # paneles
    for key in ["chat", "questions", "polls"]:
        s = sub(s, r'activePanel === "' + key + r'" \? \(', lambda m, key=key: 'visiblePanel === "' + key + '" ? (', "panel " + key)
    # sin módulos: ocultar la columna de interacción
    s = sub(s, r'(\n(\s*)<aside className="room-interaction">\n.*?\n\2</aside>\n)',
            lambda m: '\n' + m.group(2) + '{enabledPanels.length > 0 && (' + m.group(1).rstrip('\n').replace('\n' + m.group(2), '\n' + m.group(2) + '  ') + '\n' + m.group(2) + ')}\n', "columna de interacción")
    s = s.replace("Interacción sincronizada cada 2 segundos", "Interacción en tiempo real")
    p.write_text(s); print("OK room-client.tsx: módulos")
else:
    print("OK room-client.tsx: ya aplicado")

# 4) Pestaña Interacción del evento
p = root / "app/events/[slug]/event-detail.tsx"; s = p.read_text()
if "RoomModulesPanel" not in s:
    s = sub(s, r'(import "\.\./broadcast-details\.css";\n)', lambda m: m.group(1) + 'import RoomModulesPanel from "./room-modules-panel";\n', "import panel")
    s = sub(s, r'(\n(\s*)<div className="interaction-section">\n)',
            lambda m: m.group(1) + m.group(2) + '  <RoomModulesPanel slug={event.slug} />\n', "sección de interacción")
    p.write_text(s); print("OK event-detail.tsx: panel de módulos")
else:
    print("OK event-detail.tsx: ya aplicado")
print("LISTO room-modules")
