#!/usr/bin/env python3
"""(1) Automatización "Recordatorio oportunidad" (no_show_followup): misma
estructura que Seguimiento posterior, se envía tras el evento solo a quienes no
entraron; el botón de agendar aparece si hay enlace de Calendly.
(2) Duración del evento libre en minutos (5 a 720) al crear y al cambiar fecha.
Requiere en la base: ALTER TYPE communication_type ADD VALUE 'no_show_followup'.
Archivos nuevos (se copian): lib/communication-backfill.ts, app/events/duration-input.tsx,
drizzle/0039_overjoyed_jasper_sitwell.sql. Anclado e idempotente."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def read(rel): return (root / rel).read_text(encoding="utf-8")
def write(rel, s): (root / rel).write_text(s, encoding="utf-8")
def patch(rel, pairs, marker, regex=False, optional=False):
    if not (root / rel).exists():
        if optional: print(f"AVISO {rel}: no existe, se omite"); return
        print(f"ERROR {rel}: no existe"); sys.exit(1)
    s = read(rel)
    if marker in s: print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if regex:
            if not re.search(old, s): print(f"ERROR {rel}: ancla regex -> {old[:60]!r}"); sys.exit(1)
            s = re.sub(old, new, s)
        else:
            if old not in s:
                if optional: print(f"AVISO {rel}: ancla no encontrada, se omite -> {old[:60]!r}"); return
                print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
            s = s.replace(old, new)
    write(rel, s); print(f"OK {rel}: aplicado")

# 1. Enumerado en el esquema
patch("db/schema.ts", [('  "post_event",\n]);', '  "post_event",\n  "no_show_followup",\n]);')], '"no_show_followup",')

# 2. Plantilla por defecto
patch("lib/default-communications.ts", [(
'''    enabled: false,
    offsetMinutes: 60,
  },
];''',
'''    enabled: false,
    offsetMinutes: 60,
  },
  {
    // Para quienes se inscribieron pero no entraron al evento. Se programa
    // respecto al fin del evento y se cancela si la persona sí asistió.
    type: "no_show_followup" as const,
    subject: "Te extrañamos en {{event_title}}",
    body: "Hola {{participant_name}},\\n\\nNo pudimos verte en {{event_title}} y queremos compartirte lo más importante de la sesión.\\n\\n¿Conversamos? Agendar una reunión con nuestro equipo: {{schedule_link}}\\n\\nEquipo Icaza Jammoul Live",
    enabled: false,
    offsetMinutes: 1440,
  },
];''')], "no_show_followup")

# 2b. Uniones de tipo en plantillas de evento y semilla
for rel in ["app/api/event-templates/route.ts", "scripts/db-seed.ts"]:
    patch(rel, [('type: "registration_confirmation" | "reminder_24h" | "reminder_1h" | "live_now" | "post_event";',
                 'type: "registration_confirmation" | "reminder_24h" | "reminder_1h" | "live_now" | "post_event" | "no_show_followup";')], '"no_show_followup"', optional=(rel == "scripts/db-seed.ts"))

# 3. Comunicaciones: garantizar la plantilla, validar el momento y programar al activar
comm = "app/api/events/[slug]/communications/route.ts"; s = read(comm)
if "backfillAfterEventDeliveries" not in s:
    s = s.replace('import { ensureLiveNowMessage } from "@/lib/live-notifications";',
                  'import { ensureLiveNowMessage } from "@/lib/live-notifications";\nimport { backfillAfterEventDeliveries, ensureMessageOfType, isAfterEventType } from "@/lib/communication-backfill";\nimport { getPublicOrigin } from "@/lib/public-origin";', 1)
    s = s.replace("  await ensureLiveNowMessage(event.id);", "  await ensureLiveNowMessage(event.id);\n  await ensureMessageOfType(event.id, \"no_show_followup\");", 1)
    s = s.replace('    if (target.type === "post_event" && body.offsetMinutes < 0) {', '    if (isAfterEventType(target.type) && body.offsetMinutes < 0) {', 1)
    s = s.replace('    const base = target.type === "post_event" ? event.endsAt : event.startsAt;', '    const base = isAfterEventType(target.type) ? event.endsAt : event.startsAt;', 1)
    old = '''  if (!updated) {
    return NextResponse.json(
      { error: "Comunicación no encontrada." },
      { status: 404 },
    );
  }
'''
    assert old in s, "communications: updated"
    s = s.replace(old, old + '''
  // Al activar un mensaje posterior al evento, los inscritos que aún no lo
  // tienen programado lo reciben en su momento.
  if (changes.enabled === true && isAfterEventType(updated.type)) {
    await backfillAfterEventDeliveries(event.id, updated.id, getPublicOrigin(request));
  }
''', 1)
    write(comm, s); print(f"OK {comm}: recordatorio oportunidad")
else: print(f"OK {comm}: ya aplicado")

# 3b. Ficha del evento (servidor): garantiza la plantilla para eventos existentes
pg = "app/events/[slug]/page.tsx"; s = read(pg)
if "ensureMessageOfType" not in s:
    s = s.replace('import { notFound } from "next/navigation";', 'import { notFound } from "next/navigation";\nimport { ensureMessageOfType } from "@/lib/communication-backfill";', 1)
    old = "  if (!event) notFound();\n\n  const [\n    sessionRecords,"
    if old not in s: print("ERROR page.tsx: ancla"); sys.exit(1)
    s = s.replace(old, "  if (!event) notFound();\n  // Eventos creados antes de esta automatización reciben su plantilla (pausada).\n  await ensureMessageOfType(event.id, \"no_show_followup\");\n\n  const [\n    sessionRecords,", 1)
    if "ensureMessageOfType } from" not in s: print("ERROR page.tsx: import"); sys.exit(1)
    write(pg, s); print(f"OK {pg}: plantilla garantizada")
else: print(f"OK {pg}: ya aplicado")

# 4. Worker: no se envía a quien sí asistió
patch("lib/communication-worker.ts", [(
'''    if (isStaleDelivery(delivery.type, delivery.scheduledFor, now)) {''',
'''    // "Recordatorio oportunidad" es solo para quienes no entraron al evento.
    if (delivery.type === "no_show_followup") {
      const [registrationRow] = await db
        .select({ status: registrations.status })
        .from(registrations)
        .where(eq(registrations.id, delivery.registrationId))
        .limit(1);
      if (!registrationRow || registrationRow.status === "attended" || registrationRow.status === "cancelled") {
        summary.skipped += 1;
        await db
          .update(communicationDeliveries)
          .set({ status: "cancelled", error: registrationRow?.status === "attended" ? "El participante sí asistió al evento." : "La inscripción no está activa.", updatedAt: new Date() })
          .where(eq(communicationDeliveries.id, delivery.id));
        continue;
      }
    }

    if (isStaleDelivery(delivery.type, delivery.scheduledFor, now)) {''')], 'delivery.type === "no_show_followup"')
w = "lib/communication-worker.ts"; s = read(w)
if "registrations" not in s.split('} from "@/db/schema";')[0]:
    s = s.replace('import { communicationDeliveries, events } from "@/db/schema";', 'import { communicationDeliveries, events, registrations } from "@/db/schema";', 1)
    write(w, s); print("OK worker: import registrations")

# 5. Registro e invitación: se programa respecto al fin del evento
for rel in ["app/api/public/events/[slug]/register/route.ts", "app/api/participants/invite/route.ts"]:
    patch(rel, [('message.type === "post_event"\n', '(message.type === "post_event" || message.type === "no_show_followup")\n')], 'message.type === "no_show_followup"')

# 6. Ficha del evento: etiqueta, tipo y editores de momento/Calendly (tolerante al icono y sangría de Replit)
ed = "app/events/[slug]/event-detail.tsx"; s = read(ed)
if "no_show_followup: {" not in s:
    s = s.replace('type: "registration_confirmation" | "reminder_24h" | "reminder_1h" | "live_now" | "post_event";',
                  'type: "registration_confirmation" | "reminder_24h" | "reminder_1h" | "live_now" | "post_event" | "no_show_followup";', 1)
    m = re.search(r'(  post_event: \{\n    title: "Seguimiento posterior",\n    timing: "[^"]*",\n    icon: ([^\n]+?),?\n  \},\n)\};', s)
    if not m: print("ERROR event-detail: bloque post_event"); sys.exit(1)
    s = s[:m.start()] + m.group(1) + '  no_show_followup: {\n    title: "Recordatorio oportunidad",\n    timing: "Solo a quienes no entraron al evento",\n    icon: ' + m.group(2) + ',\n  },\n};' + s[m.end():]
    old = '<p>{item.type === "post_event" ? describeFollowUpOffset(item.offsetMinutes) : label.timing}</p>'
    if old not in s: print("ERROR event-detail: item.type"); sys.exit(1)
    s = s.replace(old, '<p>{item.type === "post_event" || item.type === "no_show_followup" ? `${describeFollowUpOffset(item.offsetMinutes)}${item.type === "no_show_followup" ? " · solo a quienes no entraron" : ""}` : label.timing}</p>', 1)
    n = s.count('{selectedCommunication.type === "post_event" && (')
    if n != 2: print(f"ERROR event-detail: esperaba 2 bloques post_event, hay {n}"); sys.exit(1)
    s = s.replace('{selectedCommunication.type === "post_event" && (', '{(selectedCommunication.type === "post_event" || selectedCommunication.type === "no_show_followup") && (')
    write(ed, s); print(f"OK {ed}: aplicado")
else: print(f"OK {ed}: ya aplicado")

# 7. Envío manual y plantillas
patch("app/participants/participants-list.tsx", [('    { value: "post_event", label: "Seguimiento posterior" },', '    { value: "post_event", label: "Seguimiento posterior" },\n    { value: "no_show_followup", label: "Recordatorio oportunidad" },')], '"no_show_followup"')
patch("app/api/participants/message/route.ts", [('"live_now", "post_event"] as const;', '"live_now", "post_event", "no_show_followup"] as const;')], '"no_show_followup"')

# 8. Duración libre en minutos
for rel, id_ in [("app/events/event-creator.tsx", "creator-duration"), ("app/dashboard-client.tsx", "dashboard-duration")]:
    s = read(rel)
    if "DurationInput" in s: print(f"OK {rel}: ya con DurationInput"); continue
    pattern = re.compile(r'(<label>\s*Duración\s*)<select\s+name="duration"[\s\S]*?</select>(\s*</label>)')
    s2, n = pattern.subn(lambda m: f'{m.group(1)}<DurationInput name="duration" id="{id_}" onChange={{() => setScheduleConflicts([])}} />{m.group(2)}', s)
    if n == 0: print(f"ERROR {rel}: select de duración"); sys.exit(1)
    imp = 'import DurationInput from "./duration-input";' if rel.startswith("app/events/") else 'import DurationInput from "@/app/events/duration-input";'
    last = max(m.end() for m in re.finditer(r'^import [^\n]*;\n', s2, flags=re.M))
    s2 = s2[:last] + imp + "\n" + s2[last:]
    s2 = s2.replace('if (Number.isNaN(startsAt.getTime()) || !duration) {', 'if (Number.isNaN(startsAt.getTime()) || !duration || duration < 5 || duration > 720) {', 1)
    write(rel, s2); print(f"OK {rel}: duración libre")

de = "app/events/[slug]/event-date-editor.tsx"; s = read(de)
if "DurationInput" not in s:
    s = s.replace('import { useFeedbackSetter } from "@/lib/feedback";', 'import { useFeedbackSetter } from "@/lib/feedback";\nimport DurationInput from "../duration-input";', 1)
    s = s.replace("  const initialDuration = Math.max(\n    15,", "  const initialDuration = Math.max(\n    5,", 1)
    pattern = re.compile(r'<label>\s*Duración\s*<select value=\{duration\}[\s\S]*?</select>\s*</label>')
    s2, n = pattern.subn('<label>\n        Duración\n        <DurationInput value={duration} onChange={setDuration} disabled={saving} id="date-editor-duration" />\n      </label>', s)
    if n == 0: print("ERROR date-editor: select"); sys.exit(1)
    s2 = s2.replace('if (Number.isNaN(start.getTime()) || !minutes) {', 'if (Number.isNaN(start.getTime()) || !minutes || minutes < 5 || minutes > 720) {', 1)
    write(de, s2); print(f"OK {de}: duración libre")
else: print(f"OK {de}: ya aplicado")

css = root / "app/globals.css"; g = css.read_text(encoding="utf-8")
if ".duration-input" not in g:
    g = g.rstrip("\n") + """

/* Duración en minutos con sugerencias. */
.duration-input { display: grid; gap: 4px; }
.duration-input input { width: 100%; }
.duration-input small { color: #8e8998; font-size: 11px; font-weight: 500; }
"""
    css.write_text(g, encoding="utf-8"); print("OK globals.css: duración")
else: print("OK globals.css: ya aplicado")

# 9. Centro de ayuda
hg = "lib/help-guides.ts"; s = read(hg)
if "Recordatorio oportunidad" not in s:
    old = '''        { image: img("comunicaciones-agendar"), caption: t("Enlace de agendamiento del organizador.", "Organizer scheduling link.", "Lien de prise de rendez-vous de l’organisateur.") },
      ),'''
    assert old in s, "help: agendar"
    s = s.replace(old, old + '''
      step(
        t(
          "**Recordatorio oportunidad** es una sexta automatización, con la misma estructura que el seguimiento: se envía un tiempo después de terminar el evento, pero **solo a quienes se inscribieron y no entraron**. Si la persona sí asistió, el envío se cancela solo. Actívala con su interruptor; al hacerlo, los inscritos existentes quedan programados. El botón **Agendar una reunión** aparece únicamente si guardaste tu enlace de Calendly.",
          "**Opportunity reminder** is a sixth automation with the same structure as the follow-up: it goes out some time after the event ends, but **only to people who registered and did not enter**. If the person did attend, the send cancels itself. Enable it with its switch; existing registrants are scheduled at that moment. The **Schedule a meeting** button appears only if you saved your Calendly link.",
          "**Rappel opportunité** est une sixième automatisation, de même structure que le suivi : elle part un certain temps après la fin de l’événement, mais **uniquement aux inscrits qui ne sont pas entrés**. Si la personne a assisté, l’envoi s’annule tout seul. Activez-la avec son interrupteur ; les inscrits existants sont programmés à ce moment. Le bouton **Planifier une réunion** n’apparaît que si vous avez enregistré votre lien Calendly.",
        ),
      ),''', 1)
    write(hg, s); print(f"OK {hg}: recordatorio oportunidad")
else: print(f"OK {hg}: ya aplicado")
# 10. Robustez: si el servidor responde sin JSON, el modal de creación no se queda en "Guardando…"
for rel in ["app/events/event-creator.tsx", "app/dashboard-client.tsx"]:
    s = read(rel)
    if "catch(() => ({}))" in s: print(f"OK {rel}: respuesta robusta ya aplicada"); continue
    old = "    const payload = (await response.json()) as {\n      data?: { slug: string"
    if old not in s: print(f"ERROR {rel}: payload json"); sys.exit(1)
    s = s.replace(old, "    const payload = (await response.json().catch(() => ({}))) as {\n      data?: { slug: string", 1)
    write(rel, s); print(f"OK {rel}: respuesta robusta")

print("LISTO recordatorio oportunidad y duración")
