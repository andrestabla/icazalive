#!/usr/bin/env python3
"""Lote de septiembre (2): asistencia automática, eliminar participante (admin),
página "Añadir al calendario", momento del seguimiento posterior configurable,
menú lateral y menú Acciones adaptativos. Anclado e idempotente."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def patch(rel, pairs, marker, regex=False):
    p = root / rel; s = p.read_text(encoding="utf-8")
    if marker in s:
        print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if regex:
            if not re.search(old, s): print(f"ERROR {rel}: ancla regex no encontrada -> {old[:60]!r}"); sys.exit(1)
            s = re.sub(old, new, s, count=1)
        else:
            if old not in s: print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
            s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8"); print(f"OK {rel}: aplicado")

# ---------------------------------------------------------------------------
# 1. Asistencia automática
# ---------------------------------------------------------------------------
room = root / "app/api/public/events/[slug]/room/route.ts"; r = room.read_text(encoding="utf-8")
if "markAttendance" not in r:
    # import: tras la última línea de import
    last_import = max(m.end() for m in re.finditer(r'^import [^\n]*;\n', r, flags=re.M))
    r = r[:last_import] + 'import { closeAttendance, markAttendance } from "@/lib/attendance";\n' + r[last_import:]
    # al entrar con enlace personal mientras el evento está en vivo → Asistió
    old = '''  const [record] = await db
    .select({ event: events, session: sessions })
    .from(events)
    .innerJoin(sessions, eq(sessions.eventId, events.id))
    .where(eq(events.slug, slug))
    .orderBy(sessions.startsAt)
    .limit(1);
  if (!record) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
'''
    new = old + '''
  // Asistencia automática: entrar a la sala con el enlace personal mientras
  // el evento está EN VIVO marca al inscrito como "Asistió".
  if (viewer.kind === "participant" && record.event.status === "live") {
    after(() => markAttendance(viewer.access.registrationId));
  }
'''
    assert old in r, "room route: bloque record"
    r = r.replace(old, new, 1)
    old2 = '''      if (automatedStatus === "live") {
        after(() => notifyEventLive(record.event.id));
      }'''
    new2 = '''      if (automatedStatus === "live") {
        after(() => notifyEventLive(record.event.id));
      } else {
        after(() => closeAttendance(record.event.id));
      }'''
    assert old2 in r, "room route: automatedStatus"
    r = r.replace(old2, new2, 1)
    room.write_text(r, encoding="utf-8"); print("OK room route: asistencia")
else:
    print("OK room route: ya aplicado")

patch("app/api/events/[slug]/route.ts", [
    ('import { getPublicOrigin }', 'import { closeAttendance } from "@/lib/attendance";\nimport { getPublicOrigin }'),
    ('''  // Al pasar a EN VIVO se avisa a los inscritos ("Ya estamos en vivo").
  if (changes.status === "live" && currentStatus !== "live") {''',
     '''  // Al completarse el evento, quien no entró a la sala queda como "No asistió".
  if (changes.status === "completed" && currentStatus !== "completed") {
    after(() => closeAttendance(current.id));
  }

  // Al pasar a EN VIVO se avisa a los inscritos ("Ya estamos en vivo").
  if (changes.status === "live" && currentStatus !== "live") {'''),
], "closeAttendance")

patch("lib/simulated-emitter.ts", [
    ('''        await db.update(events).set({ status: "completed", updatedAt: new Date() }).where(eq(events.id, event.id));
''', '''        await db.update(events).set({ status: "completed", updatedAt: new Date() }).where(eq(events.id, event.id));
        await closeAttendance(event.id).catch(() => 0);
'''),
], "closeAttendance")
se = root / "lib/simulated-emitter.ts"; t = se.read_text(encoding="utf-8")
if 'from "@/lib/attendance"' not in t:
    last_import = max(m.end() for m in re.finditer(r'^import [^\n]*;\n', t, flags=re.M))
    t = t[:last_import] + 'import { closeAttendance } from "@/lib/attendance";\n' + t[last_import:]
    se.write_text(t, encoding="utf-8"); print("OK simulated-emitter: import")


# participantId en la API y el tipo de la lista (para eliminar por participante)
patch("app/api/participants/route.ts", [
    ("      id: registrations.id,\n      name: users.name,\n      email: users.email,",
     "      id: registrations.id,\n      participantId: users.id,\n      name: users.name,\n      email: users.email,"),
], "participantId: users.id,")
patch("app/participants/participants-list.tsx", [
    ("  id: string;\n  name: string;\n  email: string;\n  company: string | null;",
     "  id: string;\n  participantId: string;\n  name: string;\n  email: string;\n  company: string | null;"),
], "  participantId: string;")

# ---------------------------------------------------------------------------
# 2. Eliminar participante (solo administrador) en el historial
# ---------------------------------------------------------------------------
patch("app/participants/participants-list.tsx", [
    ('''  const [historyEmail, setHistoryEmail] = useState<string | null>(null);''',
     '''  const [historyEmail, setHistoryEmail] = useState<string | null>(null);
  // Solo el administrador puede eliminar participantes de forma definitiva.
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { role?: string } } | null) => {
        if (!cancelled) setIsAdmin(payload?.data?.role === "administrator");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const deleteParticipant = async (participantId: string, name: string, email: string) => {
    if (!window.confirm(`¿Eliminar definitivamente a ${name} (${email})?\\n\\nSe borrarán sus inscripciones en todos los eventos, sus accesos y los correos pendientes. Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setError("");
    const response = await fetch(`/api/participants/${participantId}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      setRecords((items) => items.filter((item) => item.participantId !== participantId));
      setHistoryEmail(null);
      setMessage(`Participante eliminado: ${name}.`);
    } else {
      setError(payload.error ?? "No fue posible eliminar el participante.");
    }
    setDeleting(false);
  };'''),
    ('''            <div className="participant-modal-actions">
              <span />
              <button className="primary-button" disabled={saving} onClick={() => setHistoryEmail(null)}>
                {saving ? "Guardando…" : "Listo"}
              </button>
            </div>''',
     '''            <div className="participant-modal-actions">
              {isAdmin ? (
                <button
                  className="participant-delete-button"
                  disabled={saving || deleting}
                  onClick={() => void deleteParticipant(historyGroup.records[0].participantId, historyGroup.name, historyGroup.email)}
                >
                  {deleting ? "Eliminando…" : "Eliminar participante"}
                </button>
              ) : (
                <span />
              )}
              <button className="primary-button" disabled={saving} onClick={() => setHistoryEmail(null)}>
                {saving ? "Guardando…" : "Listo"}
              </button>
            </div>'''),
], "deleteParticipant")

# ---------------------------------------------------------------------------
# 3. Botón "Añadir al calendario" → página con Google / Outlook / Yahoo / .ics
# ---------------------------------------------------------------------------
patch("lib/communication-renderer.ts", [
    ('calendarUrl: `${origin}/api/public/events/${eventSlug}/calendar?access=${token}`,',
     'calendarUrl: `${origin}/calendar/${eventSlug}?access=${token}`,'),
], "/calendar/${eventSlug}?access=")
patch("app/api/public/events/[slug]/register/route.ts", [
    ('calendarUrl: `/api/public/events/${event.slug}/calendar?access=${encodedToken}`,',
     'calendarUrl: `/calendar/${event.slug}?access=${encodedToken}`,'),
], "calendarUrl: `/calendar/")

# ---------------------------------------------------------------------------
# 4. Seguimiento posterior: momento de envío configurable (relativo al fin)
# ---------------------------------------------------------------------------
for rel in ["app/api/public/events/[slug]/register/route.ts", "app/api/participants/invite/route.ts"]:
    p = root / rel; s = p.read_text(encoding="utf-8")
    if "post_event" in s and "event.endsAt.getTime() + message.offsetMinutes" in s:
        print(f"OK {rel}: post_event ya relativo al fin"); continue
    old = ": new Date(event.startsAt.getTime() + message.offsetMinutes * 60_000);"
    new = ''': message.type === "post_event"
              ? new Date(event.endsAt.getTime() + message.offsetMinutes * 60_000) // después de que termine
              : new Date(event.startsAt.getTime() + message.offsetMinutes * 60_000);'''
    if old not in s: print(f"ERROR {rel}: ancla scheduledFor"); sys.exit(1)
    s = s.replace(old, new, 1); p.write_text(s, encoding="utf-8"); print(f"OK {rel}: post_event relativo al fin")

patch("app/api/events/[slug]/communications/route.ts", [
    ('''    messageId?: string;
    enabled?: boolean;
    subject?: string;
    body?: string;
  };
''', '''    messageId?: string;
    enabled?: boolean;
    subject?: string;
    body?: string;
    offsetMinutes?: number;
  };
'''),
    ('''  if (
    body.enabled === undefined &&
    body.subject === undefined &&
    body.body === undefined
  ) {''', '''  // Momento de envío: minutos respecto al fin del evento (seguimiento) o al
  // inicio (recordatorios, en negativo). Máximo 30 días.
  const MAX_OFFSET = 30 * 24 * 60;
  if (
    body.offsetMinutes !== undefined &&
    (!Number.isInteger(body.offsetMinutes) || Math.abs(body.offsetMinutes) > MAX_OFFSET)
  ) {
    return NextResponse.json(
      { error: "El momento de envío no es válido (máximo 30 días)." },
      { status: 400 },
    );
  }
  if (
    body.enabled === undefined &&
    body.subject === undefined &&
    body.body === undefined &&
    body.offsetMinutes === undefined
  ) {'''),
    ('''  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const changes: {
    enabled?: boolean;
    subject?: string;
    body?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (body.enabled !== undefined) changes.enabled = body.enabled;
  if (subject) changes.subject = subject;
  if (messageBody) changes.body = messageBody;
''', '''  const [event] = await db
    .select({ id: events.id, startsAt: events.startsAt, endsAt: events.endsAt })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const changes: {
    enabled?: boolean;
    subject?: string;
    body?: string;
    offsetMinutes?: number;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (body.enabled !== undefined) changes.enabled = body.enabled;
  if (subject) changes.subject = subject;
  if (messageBody) changes.body = messageBody;
  if (body.offsetMinutes !== undefined) {
    const [target] = await db
      .select({ type: communicationMessages.type })
      .from(communicationMessages)
      .where(and(eq(communicationMessages.id, body.messageId), eq(communicationMessages.eventId, event.id)))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: "Comunicación no encontrada." }, { status: 404 });
    }
    if (target.type === "post_event" && body.offsetMinutes < 0) {
      return NextResponse.json({ error: "El seguimiento se envía después del evento: usa un valor de 0 o más." }, { status: 400 });
    }
    if ((target.type === "reminder_24h" || target.type === "reminder_1h") && body.offsetMinutes >= 0) {
      return NextResponse.json({ error: "Los recordatorios se envían antes del evento: usa minutos en negativo." }, { status: 400 });
    }
    if (target.type === "registration_confirmation" || target.type === "live_now") {
      return NextResponse.json({ error: "Este mensaje no admite cambiar el momento de envío." }, { status: 400 });
    }
    changes.offsetMinutes = body.offsetMinutes;
    // Las entregas ya programadas de este mensaje se mueven al nuevo momento.
    const base = target.type === "post_event" ? event.endsAt : event.startsAt;
    await db
      .update(communicationDeliveries)
      .set({ scheduledFor: new Date(base.getTime() + body.offsetMinutes * 60_000), updatedAt: new Date() })
      .where(
        and(
          eq(communicationDeliveries.messageId, body.messageId),
          eq(communicationDeliveries.status, "scheduled"),
        ),
      );
  }
'''),
], "offsetMinutes?: number;")

patch("app/events/[slug]/event-detail.tsx", [
    ('''    changes: Partial<Pick<CommunicationMessage, "enabled" | "subject" | "body">>,''',
     '''    changes: Partial<Pick<CommunicationMessage, "enabled" | "subject" | "body" | "offsetMinutes">>,'''),
    ('''                        <p>{label.timing}</p>''',
     '''                        <p>{item.type === "post_event" ? describeFollowUpOffset(item.offsetMinutes) : label.timing}</p>'''),
    ('''const communicationLabels: Record<''',
     '''// Texto del momento de envío del seguimiento posterior (minutos tras el fin).
function describeFollowUpOffset(minutes: number): string {
  if (minutes <= 0) return "Al terminar el evento";
  if (minutes % 1440 === 0) return `${minutes / 1440} día${minutes === 1440 ? "" : "s"} después del evento`;
  if (minutes % 60 === 0) return `${minutes / 60} hora${minutes === 60 ? "" : "s"} después del evento`;
  return `${minutes} minutos después del evento`;
}

const communicationLabels: Record<'''),
    ('''                  {selectedCommunication.type === "post_event" && (
                    <div className="scheduling-link-box">''',
     '''                  {selectedCommunication.type === "post_event" && (
                    <FollowUpTiming
                      key={selectedCommunication.id}
                      offsetMinutes={selectedCommunication.offsetMinutes}
                      saving={communicationSaving}
                      onSave={(minutes) => void patchCommunication(selectedCommunication.id, { offsetMinutes: minutes })}
                    />
                  )}
                  {selectedCommunication.type === "post_event" && (
                    <div className="scheduling-link-box">'''),
], "describeFollowUpOffset")

# Componente FollowUpTiming al final del archivo
ed = root / "app/events/[slug]/event-detail.tsx"; e = ed.read_text(encoding="utf-8")
if "function FollowUpTiming" not in e:
    e = e.rstrip("\n") + '''

// Selector del momento de envío del seguimiento posterior: cantidad y unidad
// (minutos u horas) después de que termine el evento.
function FollowUpTiming({
  offsetMinutes,
  saving,
  onSave,
}: {
  offsetMinutes: number;
  saving: boolean;
  onSave: (minutes: number) => void;
}) {
  const initialUnit: "min" | "h" = offsetMinutes > 0 && offsetMinutes % 60 === 0 ? "h" : "min";
  const [unit, setUnit] = useState<"min" | "h">(initialUnit);
  const [value, setValue] = useState<string>(String(initialUnit === "h" ? offsetMinutes / 60 : offsetMinutes));
  const minutes = Math.max(0, Math.round(Number(value) || 0)) * (unit === "h" ? 60 : 1);
  const changed = minutes !== offsetMinutes;
  return (
    <div className="followup-timing">
      <p className="eyebrow">MOMENTO DE ENVÍO</p>
      <div className="followup-timing-row">
        <span>Enviar</span>
        <input
          type="number"
          min={0}
          max={unit === "h" ? 720 : 43200}
          step={1}
          value={value}
          onChange={(input) => setValue(input.target.value)}
          aria-label="Cantidad"
        />
        <select value={unit} onChange={(input) => setUnit(input.target.value as "min" | "h")} aria-label="Unidad">
          <option value="min">minutos</option>
          <option value="h">horas</option>
        </select>
        <span>después de que termine el evento</span>
        <button type="button" className="secondary-button" disabled={saving || !changed} onClick={() => onSave(minutes)}>
          {saving ? "Guardando…" : "Guardar momento"}
        </button>
      </div>
      <small>Ahora: {describeFollowUpOffset(offsetMinutes)}. Las entregas ya programadas se mueven al nuevo momento.</small>
    </div>
  );
}
'''
    ed.write_text(e, encoding="utf-8"); print("OK event-detail: FollowUpTiming")

# ---------------------------------------------------------------------------
# 5. Adaptativo: menú lateral con scroll y menú Acciones que se abre hacia arriba
# ---------------------------------------------------------------------------
patch("app/globals.css", [
    ('''  background: #fff; border-right: 1px solid var(--line); display: flex; flex-direction: column; z-index: 5;
}''', '''  background: #fff; border-right: 1px solid var(--line); display: flex; flex-direction: column; z-index: 5;
  overflow-y: auto; overscroll-behavior: contain;
}'''),
], "overscroll-behavior: contain;")
css = root / "app/globals.css"; c = css.read_text(encoding="utf-8")
if "followup-timing" not in c:
    c = c.rstrip("\n") + '''

/* Seguimiento posterior: momento de envío. */
.followup-timing { margin: 14px 0 6px; padding: 14px 16px; border: 1px solid #e6e2ec; border-radius: 11px; background: #faf9fc; }
.followup-timing-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; color: #4f4a58; }
.followup-timing-row input { width: 74px !important; flex: 0 0 74px; padding: 7px 9px; border: 1px solid #d9d5e0; border-radius: 8px; font: inherit; }
.followup-timing-row select { flex: 0 0 auto; width: auto !important; }
.followup-timing-row .secondary-button { margin-left: auto; }
.followup-timing-row select { padding: 7px 9px; border: 1px solid #d9d5e0; border-radius: 8px; font: inherit; background: #fff; }
.followup-timing > small { display: block; margin-top: 8px; color: #8e8998; font-size: 11px; }

/* Participantes: eliminación definitiva (solo administrador). */
.participant-delete-button { border: 1px solid #edccd2; border-radius: 8px; background: #fff5f6; color: #ae3f53; padding: 9px 12px; font-size: 12px; font-weight: 650; cursor: pointer; }
.participant-delete-button:disabled { opacity: .6; cursor: default; }
'''
    css.write_text(c, encoding="utf-8"); print("OK globals.css: estilos lote 2")

patch("app/events/events-actions.css", [
    ('''.event-actions-menu {
  position: fixed;''', '''.event-actions-menu.up { transform: translate(-100%, -100%); }
.event-actions-menu {
  position: fixed;'''),
], ".event-actions-menu.up")

patch("app/events/events-list.tsx", [
    ('''                          : { event, x: bounds.right, y: bounds.bottom + 6 },''',
     '''                          : (() => {
                              // Si no cabe debajo del botón, el menú se abre hacia arriba.
                              const up = bounds.bottom + 6 + 130 > window.innerHeight;
                              return { event, x: bounds.right, y: up ? bounds.top - 6 : bounds.bottom + 6, up };
                            })(),'''),
    ('''          className="event-actions-menu"''', '''          className={`event-actions-menu${actionsMenu.up ? " up" : ""}`}'''),
], "actionsMenu.up")
el = root / "app/events/events-list.tsx"; s = el.read_text(encoding="utf-8")
if "up?: boolean;" not in s:
    s = s.replace('''    x: number;
    y: number;''', '''    x: number;
    y: number;
    up?: boolean;''', 1); el.write_text(s, encoding="utf-8"); print("OK events-list: tipo up")

print("LISTO lote 2")
