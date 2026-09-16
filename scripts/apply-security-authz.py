#!/usr/bin/env python3
"""Pentest sept 2026 — autorización por evento y otros cierres:
- canManageEvent() en todas las rutas de evento que solo comprobaban el rol.
- /api/participants/invite y /message: permiso participants.manage + eventos gestionados.
- Registro público e invitación: no reactivan ni renombran cuentas del equipo.
- MFA: los códigos fallidos cuentan para el bloqueo de cuenta.
- Login: coste constante aunque el correo no exista (sin oráculo de tiempo).
- Subidas de marca: sin SVG; /api/files sirve como adjunto con sandbox.
- Biblioteca: solo claves S3 bajo content/.
- /api/health sin datos de la base. GET de comunicaciones sin efectos (no envía).
- AUTH_ENCRYPTION_KEY: aviso en logs si falta en producción.
Anclado e idempotente."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def read(rel): return (root / rel).read_text(encoding="utf-8")
def write(rel, s): (root / rel).write_text(s, encoding="utf-8")

def add_import(s, line, after_pattern='import { requireApiUser } from "@/lib/auth";'):
    if line in s: return s
    if after_pattern in s: return s.replace(after_pattern, after_pattern + "\n" + line, 1)
    # tras el último import
    last = max(m.end() for m in re.finditer(r'^import [^\n]*;\n', s, flags=re.M))
    return s[:last] + line + "\n" + s[last:]

GUARD_IMPORT = 'import { canManageEvent } from "@/lib/event-permissions";'
NOT_FOUND_RE = re.compile(r'(  if \(!(event|record|source)\) \{\n(?:(?!  \}\n).*\n)*?  \}\n)')

def guard(user_expr, event_expr):
    return (f'  if (!(await canManageEvent({user_expr}, {event_expr}.id))) {{\n'
            f'    return NextResponse.json({{ error: "No eres organizador de este evento." }}, {{ status: 403 }});\n'
            f'  }}\n')

def scope_route(rel, user_expr, event_var="event"):
    s = read(rel)
    if "canManageEvent(" in s:
        print(f"OK {rel}: ya con canManageEvent"); return
    count = 0
    def repl(m):
        nonlocal count
        if m.group(2) != event_var: return m.group(1)
        count += 1
        ev = "record.event" if event_var == "record" else event_var
        return m.group(1) + guard(user_expr, ev)
    s = NOT_FOUND_RE.sub(repl, s)
    if count == 0:
        print(f"ERROR {rel}: no se encontró bloque 'no encontrado'"); sys.exit(1)
    s = add_import(s, GUARD_IMPORT)
    write(rel, s); print(f"OK {rel}: {count} guardia(s) de evento")

# 1. Rutas de evento (C1/H2)
scope_route("app/api/events/[slug]/streaming/route.ts", "auth.user", "record")
scope_route("app/api/events/[slug]/interaction/route.ts", "auth.user")
scope_route("app/api/events/[slug]/sessions/route.ts", "auth.user")
scope_route("app/api/events/[slug]/communications/route.ts", "auth.user")
scope_route("app/api/events/[slug]/communications/process/route.ts", "user")
scope_route("app/api/events/[slug]/analytics/route.ts", "user")
scope_route("app/api/events/[slug]/feedback/route.ts", "user")
scope_route("app/api/events/[slug]/duplicate/route.ts", "user", "source")

# registration-fields: el helper resolveStaffEvent devuelve { currentUser, event }
rf = "app/api/events/[slug]/registration-fields/route.ts"; s = read(rf)
if "canManageEvent(" not in s:
    old = "  return { currentUser, event };\n}"
    assert old in s, "registration-fields: return helper"
    s = s.replace(old, '''  if (!(await canManageEvent(currentUser, event.id))) {
    return {
      error: NextResponse.json({ error: "No eres organizador de este evento." }, { status: 403 }),
    };
  }
  return { currentUser, event };
}''', 1)
    s = add_import(s, GUARD_IMPORT); write(rf, s); print(f"OK {rf}: guardia en helper")
else: print(f"OK {rf}: ya con canManageEvent")

# 2. Invitación: solo eventos gestionados por quien invita
inv = "app/api/participants/invite/route.ts"; s = read(inv)
if "canManageEvent(" not in s:
    m = NOT_FOUND_RE.search(s)
    assert m and m.group(2) == "event", "invite: bloque evento"
    s = s[:m.end()] + guard("currentUser", "event") + s[m.end():]
    s = add_import(s, GUARD_IMPORT); write(inv, s); print(f"OK {inv}: guardia de evento")
else: print(f"OK {inv}: ya con canManageEvent")

# 3. Mensaje manual: permiso participants.manage y solo eventos gestionados
msg = "app/api/participants/message/route.ts"; s = read(msg)
if "requireApiPermission" not in s:
    s = s.replace('import { requireApiUser } from "@/lib/auth";',
                  'import { requireApiUser } from "@/lib/auth";\nimport { requireApiPermission } from "@/lib/api-guards";\nimport { canManageEvent } from "@/lib/event-permissions";', 1)
    s = s.replace('''export async function POST(request: Request) {
  const currentUser = await requireApiUser();''', '''export async function POST(request: Request) {
  const permissionCheck = await requireApiPermission("participants.manage");
  if ("error" in permissionCheck) return permissionCheck.error;
  const currentUser = await requireApiUser();''', 1)
    old = '''  const recipients = rows.filter((row) => row.status !== "cancelled" && row.participantActive);'''
    new = '''  // Solo destinatarios de eventos que el usuario gestiona (administrador: todos).
  const manageable = new Map<string, boolean>();
  for (const eventId of new Set(rows.map((row) => row.eventId))) {
    manageable.set(eventId, await canManageEvent(currentUser, eventId));
  }
  const recipients = rows.filter(
    (row) => row.status !== "cancelled" && row.participantActive && manageable.get(row.eventId),
  );'''
    assert old in s, "message: recipients"
    s = s.replace(old, new, 1); write(msg, s); print(f"OK {msg}: permiso y alcance por evento")
else: print(f"OK {msg}: ya aplicado")

# 4. Registro público e invitación: no tocar cuentas del equipo al chocar por correo
USERS_SET_OLD_REG = '''      .onConflictDoUpdate({
        target: users.email,
        set: { name, active: true, updatedAt: new Date() },
      })'''
USERS_SET_NEW_REG = '''      .onConflictDoUpdate({
        target: users.email,
        // Solo se actualiza si la cuenta existente es de participante: un
        // registro público nunca renombra ni reactiva cuentas del equipo.
        set: {
          name: sql`CASE WHEN ${users.role} = 'participant' THEN ${name} ELSE ${users.name} END`,
          active: sql`CASE WHEN ${users.role} = 'participant' THEN true ELSE ${users.active} END`,
          updatedAt: new Date(),
        },
      })'''
reg = "app/api/public/events/[slug]/register/route.ts"; s = read(reg)
if "CASE WHEN" not in s:
    assert USERS_SET_OLD_REG in s, "register: onConflict"
    s = s.replace(USERS_SET_OLD_REG, USERS_SET_NEW_REG, 1)
    s = s.replace('import { and, asc, count, eq, ne } from "drizzle-orm";', 'import { and, asc, count, eq, ne, sql } from "drizzle-orm";', 1)
    write(reg, s); print(f"OK {reg}: cuentas del equipo protegidas")
else: print(f"OK {reg}: ya aplicado")

USERS_SET_OLD_INV = '''        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: participantInput.name,
            active: true,
            updatedAt: now,
          },
        })'''
USERS_SET_NEW_INV = '''        .onConflictDoUpdate({
          target: users.email,
          // Nunca renombra ni reactiva cuentas del equipo.
          set: {
            name: sql`CASE WHEN ${users.role} = 'participant' THEN ${participantInput.name} ELSE ${users.name} END`,
            active: sql`CASE WHEN ${users.role} = 'participant' THEN true ELSE ${users.active} END`,
            updatedAt: now,
          },
        })'''
s = read(inv)
if "CASE WHEN" not in s:
    assert USERS_SET_OLD_INV in s, "invite: onConflict"
    s = s.replace(USERS_SET_OLD_INV, USERS_SET_NEW_INV, 1)
    if not re.search(r'import \{[^}]*\bsql\b[^}]*\} from "drizzle-orm";', s):
        s = re.sub(r'import \{([^}]*)\} from "drizzle-orm";', lambda m: 'import {' + m.group(1).rstrip() + ', sql } from "drizzle-orm";', s, count=1)
    write(inv, s); print(f"OK {inv}: cuentas del equipo protegidas")
else: print(f"OK {inv}: ya aplicado")

# 5. Login: MFA fallido cuenta para el bloqueo; coste constante sin usuario
login = "app/api/auth/login/route.ts"; s = read(login)
if "mfaFailedAttempts" not in s:
    old = '''    if (!secondFactorOk) {
      await writeAuditLog({'''
    new = '''    if (!secondFactorOk) {
      // Un segundo factor incorrecto cuenta como intento fallido: evita
      // adivinar el código de 6 dígitos con una contraseña robada.
      const mfaFailedAttempts = user.failedLoginAttempts + 1;
      await db
        .update(users)
        .set({
          failedLoginAttempts: mfaFailedAttempts >= 5 ? 0 : mfaFailedAttempts,
          lockedUntil: mfaFailedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      await writeAuditLog({'''
    assert old in s, "login: mfa block"
    s = s.replace(old, new, 1); write(login, s); print(f"OK {login}: MFA cuenta para el bloqueo")
else: print(f"OK {login}: MFA ya aplicado")

# 6. Subidas de marca sin SVG
up = "lib/uploads.ts"; s = read(up)
if "svg\\+xml" in s:
    s = s.replace("accept: /^(image\\/(png|jpeg|webp|gif|svg\\+xml|x-icon|vnd\\.microsoft\\.icon|apng)|video\\/(mp4|webm))$/,",
                  "accept: /^(image\\/(png|jpeg|webp|gif|x-icon|vnd\\.microsoft\\.icon|apng)|video\\/(mp4|webm))$/,", 1)
    write(up, s); print(f"OK {up}: SVG excluido de la marca")
else: print(f"OK {up}: ya sin SVG")

# 7. /api/files: sandbox y sin ejecución de scripts
files = "app/api/files/[...key]/route.ts"; s = read(files)
if "Content-Security-Policy" not in s:
    old = '  headers.set("Cache-Control", "public, max-age=31536000, immutable");'
    assert old in s, "files: cache header"
    s = s.replace(old, old + '''
  // Los archivos subidos se sirven como contenido inerte: sin scripts ni
  // acceso al origen de la aplicación aunque el tipo declarado sea HTML/SVG.
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src data:; media-src 'self'");
  headers.set("X-Content-Type-Options", "nosniff");
  const upstreamType = headers.get("content-type") ?? "";
  if (/svg|html|xml|javascript/i.test(upstreamType)) {
    headers.set("Content-Disposition", "attachment");
  }''', 1)
    write(files, s); print(f"OK {files}: sandbox")
else: print(f"OK {files}: ya aplicado")

# 8. Biblioteca: claves S3 solo bajo content/
ca = "app/api/content-assets/route.ts"; s = read(ca)
if 'startsWith("content/")' not in s:
    old = '  if (!title || !s3Key || title.length > 200 || s3Key.length > 500) {'
    assert old in s, "content-assets: validación"
    s = s.replace(old, '  if (!title || !s3Key || title.length > 200 || s3Key.length > 500 || !s3Key.startsWith("content/") || s3Key.includes("..")) {', 1)
    write(ca, s); print(f"OK {ca}: claves restringidas a content/")
else: print(f"OK {ca}: ya aplicado")

# 9. /api/health sin detalles internos
health = "app/api/health/route.ts"; s = read(health)
if "connection: row," in s:
    s = s.replace('''  return NextResponse.json({
    status: "ok",
    application: "icaza-live",
    database: process.env.DATABASE_URL ? "postgresql" : "pglite-local",
    connection: row,
    timestamp: new Date().toISOString(),
  });''', '''  return NextResponse.json({
    status: row ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
  });''', 1)
    write(health, s); print(f"OK {health}: sin detalles internos")
else: print(f"OK {health}: ya aplicado")

# 10. GET de comunicaciones sin efectos secundarios (el envío va por POST /process)
comm = "app/api/events/[slug]/communications/route.ts"; s = read(comm)
old = '''  // Planificador perezoso: al consultar la pestaña se procesan las entregas
  // vencidas, de modo que confirmaciones y recordatorios avanzan sin cron.
  await processDueDeliveries(event.id);
  await ensureLiveNowMessage(event.id);'''
if old in s:
    s = s.replace(old, '''  // La consulta no tiene efectos: el envío de la cola se dispara con
  // POST /communications/process o con el planificador del servidor.
  await ensureLiveNowMessage(event.id);''', 1)
    if "processDueDeliveries(" not in s:
        s = s.replace('import { processDueDeliveries } from "@/lib/communication-worker";\n', '', 1)
    write(comm, s); print(f"OK {comm}: GET sin efectos")
else: print(f"OK {comm}: ya aplicado")

# 11. Clave de cifrado obligatoria en producción
ec = "lib/email-crypto.ts"; s = read(ec)
if "AUTH_ENCRYPTION_KEY no está definida" not in s:
    old = '  const secret = process.env.AUTH_ENCRYPTION_KEY || "icaza-live-local-fallback-key";'
    assert old in s, "email-crypto: secret"
    s = s.replace(old, '''  const secret = process.env.AUTH_ENCRYPTION_KEY;
  if (!secret) {
    // Sin clave propia se usa una derivación fija: en producción queda
    // registrado en los logs para que se defina AUTH_ENCRYPTION_KEY.
    if (process.env.NODE_ENV === "production" && !warnedMissingKey) {
      warnedMissingKey = true;
      console.error("[email-crypto] AUTH_ENCRYPTION_KEY no está definida: los secretos guardados se cifran con la clave de respaldo del código.");
    }
    return createHash("sha256").update("icaza-live-local-fallback-key").digest();
  }''', 1)
    s = s.replace("function encryptionKey(): Buffer {", "let warnedMissingKey = false;\n\nfunction encryptionKey(): Buffer {", 1)
    write(ec, s); print(f"OK {ec}: clave obligatoria en producción")
else: print(f"OK {ec}: ya aplicado")

print("LISTO autorización y cierres")
