#!/usr/bin/env python3
"""Suite de administración (septiembre 2026):
1. Perfil de usuario (/profile): nombre, foto, idioma, zona horaria y enlace de agendamiento.
2. Idioma inglés para toda la plataforma (lib/i18n, cookie + preferencia del usuario).
3. Foto sincronizada desde Google al entrar por SSO.
4. Equipo: editar nombre y correo, reenviar credenciales.
5. Analítica: alcance por organizador; filtros de fecha, evento y organizador para el administrador.
6. Contenidos: el organizador solo retira o renombra lo que subió.
7. Resumen: la tarjeta de próximos eventos ya no desborda.
Requiere migración 0040 (users.locale, users.avatar_url, users.avatar_source).
Archivos nuevos copiados por el script de despliegue. Anclado e idempotente."""
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
            s = re.sub(old, new, s, count=1)
        else:
            if old not in s: print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
            s = s.replace(old, new, 1)
    write(rel, s); print(f"OK {rel}: aplicado")

# ---------------------------------------------------------------------------
# 1. Esquema: idioma y foto del usuario
# ---------------------------------------------------------------------------
patch("db/schema.ts", [(
'''  schedulingUrl: text("scheduling_url"),
  mfaEnabled:''',
'''  schedulingUrl: text("scheduling_url"),
  // Idioma de la interfaz ("es" por defecto) y foto de perfil (subida o de Google).
  locale: text("locale"),
  avatarUrl: text("avatar_url"),
  avatarSource: text("avatar_source"),
  mfaEnabled:''')], 'avatarSource: text("avatar_source")')

# ---------------------------------------------------------------------------
# 3. Google SSO: foto de perfil
# ---------------------------------------------------------------------------
patch("lib/google-sso.ts", [
    ('  name: string | null;\n  hostedDomain: string | null;\n};', '  name: string | null;\n  picture: string | null;\n  hostedDomain: string | null;\n};'),
    ('      name?: string;\n      hd?: string;', '      name?: string;\n      picture?: string;\n      hd?: string;'),
    ('        name: claims.name ?? null,\n        hostedDomain: claims.hd ?? null,', '        name: claims.name ?? null,\n        picture: typeof claims.picture === "string" && /^https:\\/\\//.test(claims.picture) ? claims.picture.slice(0, 500) : null,\n        hostedDomain: claims.hd ?? null,'),
], "picture: string | null;")
patch("app/api/auth/sso/callback/route.ts", [
    ('  const { email, emailVerified, name, hostedDomain } = result.identity;', '  const { email, emailVerified, name, picture, hostedDomain } = result.identity;'),
    ('''  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, account.id));''',
     '''  // La foto de Google se sincroniza en cada ingreso, salvo que la persona
  // haya subido una propia desde su perfil.
  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      ...(picture && account.avatarSource !== "upload"
        ? { avatarUrl: picture, avatarSource: "google" }
        : {}),
    })
    .where(eq(users.id, account.id));'''),
], 'avatarSource !== "upload"')
# ---------------------------------------------------------------------------
# 1b. Usuario autenticado con idioma y foto (sesión) y /api/auth/me
# ---------------------------------------------------------------------------
patch("lib/auth.ts", [
    ('  role: "administrator" | "organizer" | "participant";\n};', '  role: "administrator" | "organizer" | "participant";\n  locale?: string | null;\n  avatarUrl?: string | null;\n};'),
    ('      role: users.role,\n    })\n    .from(authSessions)', '      role: users.role,\n      locale: users.locale,\n      avatarUrl: users.avatarUrl,\n    })\n    .from(authSessions)'),
], "avatarUrl?: string | null;")
patch("app/api/auth/me/route.ts", [
    ('      schedulingUrl: users.schedulingUrl,\n    })', '      schedulingUrl: users.schedulingUrl,\n      locale: users.locale,\n      avatarUrl: users.avatarUrl,\n      avatarSource: users.avatarSource,\n    })'),
    ('schedulingUrl: record?.schedulingUrl ?? null } },', 'schedulingUrl: record?.schedulingUrl ?? null, locale: record?.locale ?? "es", avatarUrl: record?.avatarUrl ?? null, avatarSource: record?.avatarSource ?? null } },'),
], "avatarSource: users.avatarSource")

# ---------------------------------------------------------------------------
# 1c. Subidas: directorio avatars/ (público, como brand/)
# ---------------------------------------------------------------------------
patch("lib/uploads.ts", [
    ('  content: {\n    prefix: "content/",', '  avatars: {\n    prefix: "avatars/",\n    maxBytes: 3 * 1024 * 1024,\n    accept: /^image\\/(png|jpeg|webp|gif)$/,\n    label: "Perfil",\n  },\n  content: {\n    prefix: "content/",'),
    ('  return /^brand\\/[A-Za-z0-9._-]{1,160}$/.test(key);', '  return /^(brand|avatars)\\/[A-Za-z0-9._-]{1,160}$/.test(key);'),
], 'prefix: "avatars/"')
s2 = read("lib/uploads.ts")
if 'export type UploadScope = "brand" | "participants" | "content";' in s2:
    write("lib/uploads.ts", s2.replace('export type UploadScope = "brand" | "participants" | "content";', 'export type UploadScope = "brand" | "participants" | "avatars" | "content";', 1)); print("OK lib/uploads.ts: tipo UploadScope")

# ---------------------------------------------------------------------------
# 1d. Menú lateral: el nombre lleva al perfil y muestra la foto
# ---------------------------------------------------------------------------
sb = "app/components/admin-sidebar.tsx"; s = read(sb)
if 'href="/profile"' not in s:
    s = s.replace('  | "Privacidad";', '  | "Privacidad"\n  | "Perfil";', 1)
    s = s.replace("  active: SidebarSection;\n}) {", "  active?: SidebarSection;\n}) {", 1)
    m = re.search(r'<div className="profile">\s*<div className="avatar">\{initials\}</div>\s*<div><b>\{user\.name\}</b><small>\{roleLabels\[user\.role\]\}</small></div>', s)
    if not m: print("ERROR sidebar: bloque de perfil"); sys.exit(1)
    s = s[:m.start()] + '''<div className="profile">
          <Link href="/profile" className="profile-link" title="Mi perfil">
            <div className="avatar">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials}
            </div>
            <div><b>{user.name}</b><small>{roleLabels[user.role]}</small></div>
          </Link>''' + s[m.end():]
    write(sb, s); print(f"OK {sb}: enlace al perfil")
else: print(f"OK {sb}: ya aplicado")

# ---------------------------------------------------------------------------
# 2. Idioma: <html lang> y traducción en tiempo de ejecución
# ---------------------------------------------------------------------------
lay = "app/layout.tsx"; s = read(lay)
if "I18nRuntime" not in s:
    s = s.replace('import { getBrandSettings } from "@/lib/brand";', 'import { getBrandSettings } from "@/lib/brand";\nimport I18nRuntime from "@/lib/i18n/runtime";\nimport { resolveLocale } from "@/lib/i18n/server";', 1)
    old = "  const brand = await getBrandSettings().catch(() => null);\n  const loaderStyle"
    if old not in s: print("ERROR layout: brand"); sys.exit(1)
    s = s.replace(old, "  const brand = await getBrandSettings().catch(() => null);\n  const locale = await resolveLocale();\n  const loaderStyle", 1)
    old = '    <html lang="es">\n      <body className={`${geistSans.variable} ${geistMono.variable}`} style={loaderStyle}>\n        {children}'
    if old not in s: print("ERROR layout: html"); sys.exit(1)
    s = s.replace(old, '''    <html lang={locale} data-locale={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable}`} style={loaderStyle}>
        {locale !== "es" && (
          // Evita que la interfaz se vea un instante en español antes de traducirse.
          <style>{`html[data-locale="en"]:not(.i18n-ready) body > *:not(script) { visibility: hidden; }`}</style>
        )}
        <I18nRuntime locale={locale} />
        {children}''', 1)
    write(lay, s); print(f"OK {lay}: idioma")
else: print(f"OK {lay}: ya aplicado")

css = root / "app/globals.css"; g = css.read_text(encoding="utf-8")
if ".profile-link" not in g:
    g = g.rstrip("\n") + """

/* Perfil en el menú lateral y foto de usuario. */
.profile-link { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; text-decoration: none; color: inherit; border-radius: 10px; }
.profile-link:hover b { color: var(--purple, #6946df); }
.profile-link > div:nth-child(2) { min-width: 0; }
.profile-link b, .profile-link small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.avatar { overflow: hidden; flex: none; }
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Resumen: la fila de próximos eventos se adapta al ancho de la tarjeta. */
.events-panel { container-type: inline-size; }
.event-row { grid-template-columns: 46px minmax(0, 1fr) auto auto 24px; }
.event-row > * { min-width: 0; }
.event-info h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attendees b, .attendees small { white-space: nowrap; }
.events-panel .panel-heading > a { white-space: nowrap; }
@container (max-width: 560px) {
  .event-row { grid-template-columns: 46px minmax(0, 1fr) 24px; }
  .event-row .attendees, .event-row .status { display: none; }
}
"""
    css.write_text(g, encoding="utf-8"); print("OK globals.css: perfil y tarjeta de eventos")
else: print("OK globals.css: ya aplicado")


# ---------------------------------------------------------------------------
# 5. Analítica: alcance por organizador y filtros del administrador
# ---------------------------------------------------------------------------
an = "app/analytics/page.tsx"; s = read(an)
if "AnalyticsFilters" not in s:
    s = s.replace('import { desc, sql } from "drizzle-orm";', 'import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";', 1)
    s = s.replace('import { events, registrations } from "@/db/schema";', 'import { eventOrganizers, events, registrations, users } from "@/db/schema";\nimport { getCurrentUser } from "@/lib/auth";\nimport { platformLocalToDate } from "@/lib/timezone";\nimport AnalyticsFilters from "./analytics-filters";', 1)
    old = "export default async function AnalyticsPage() {\n  const eventRecords = await getDb()"
    if old not in s: print("ERROR analytics: firma"); sys.exit(1)
    s = s.replace(old, '''export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Alcance: el organizador solo ve sus eventos; el administrador ve todo y
  // puede filtrar por organizador, evento y rango de fechas.
  const viewer = await getCurrentUser();
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim().slice(0, 64) : "");
  const isAdmin = viewer?.role === "administrator";
  const filter = {
    organizer: isAdmin ? pick("organizer") : "",
    event: pick("event"),
    from: /^\\d{4}-\\d{2}-\\d{2}$/.test(pick("from")) ? pick("from") : "",
    to: /^\\d{4}-\\d{2}-\\d{2}$/.test(pick("to")) ? pick("to") : "",
  };
  const scopeUserId = isAdmin ? filter.organizer : viewer?.id ?? "";
  const scopeDb = getDb();
  const conditions = [];
  if (scopeUserId) {
    const managed = scopeDb.select({ id: eventOrganizers.eventId }).from(eventOrganizers).where(eq(eventOrganizers.userId, scopeUserId));
    conditions.push(or(inArray(events.id, managed), eq(events.createdBy, scopeUserId)));
  }
  if (filter.event) conditions.push(eq(events.id, filter.event));
  if (filter.from) conditions.push(gte(events.startsAt, platformLocalToDate(`${filter.from}T00:00`)));
  if (filter.to) conditions.push(lte(events.startsAt, platformLocalToDate(`${filter.to}T23:59`)));
  const scope = conditions.length ? and(...conditions) : undefined;
  const [organizers, allEvents] = isAdmin
    ? await Promise.all([
        scopeDb.select({ id: users.id, name: users.name }).from(users).where(and(ne(users.role, "participant"), eq(users.active, true))).orderBy(asc(users.name)),
        scopeDb.select({ id: events.id, title: events.title }).from(events).orderBy(desc(events.startsAt)),
      ])
    : [[], []];

  const eventRecords = await getDb()''', 1)
    old = "    .from(events)\n    .orderBy(desc(events.startsAt));\n\n  const eventMetrics"
    if old not in s: print("ERROR analytics: consulta de eventos"); sys.exit(1)
    s = s.replace(old, "    .from(events)\n    .where(scope)\n    .orderBy(desc(events.startsAt));\n  const scopedEventIds = eventRecords.map((event) => event.id);\n  const registrationScope = scopedEventIds.length ? inArray(registrations.eventId, scopedEventIds) : sql`false`;\n\n  const eventMetrics", 1)
    n = s.count("      .from(registrations)\n      .groupBy(")
    if n != 2: print(f"ERROR analytics: esperaba 2 consultas de registros, hay {n}"); sys.exit(1)
    s = s.replace("      .from(registrations)\n      .groupBy(", "      .from(registrations)\n      .where(registrationScope)\n      .groupBy(")
    m = re.search(r'<span>Datos actualizados al abrir esta página</span>\s*</header>', s)
    if not m: print("ERROR analytics: cabecera"); sys.exit(1)
    s = s[:m.end()] + '''
      {isAdmin && (
        <AnalyticsFilters
          organizers={organizers}
          events={allEvents}
          value={filter}
        />
      )}''' + s[m.end():]
    s = s.replace("<p>Resultados consolidados de todos tus eventos.</p>", '<p>{isAdmin ? "Resultados consolidados de todos los eventos." : "Resultados consolidados de tus eventos."}</p>', 1)
    write(an, s); print(f"OK {an}: alcance y filtros")
else: print(f"OK {an}: ya aplicado")

css = root / "app/globals.css"; g = css.read_text(encoding="utf-8")
if ".analytics-filters" not in g:
    g = g.rstrip("\n") + """

/* Analítica: filtros del administrador. */
.analytics-filters { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: end; margin: -6px 0 18px; padding: 12px 14px; background: #fff; border: 1px solid var(--line, #e6e3ec); border-radius: 12px; }
.analytics-filters .filter-select { display: grid; gap: 4px; font-size: 12px; font-weight: 650; color: #6f6b7c; }
.analytics-filters .filter-select select, .analytics-filters .filter-select input { font: inherit; font-weight: 500; padding: 7px 9px; border: 1px solid var(--line, #e6e3ec); border-radius: 8px; background: #fff; min-width: 160px; color: #33303d; }
.analytics-filters .secondary-action { padding: 8px 12px; }
"""
    css.write_text(g, encoding="utf-8"); print("OK globals.css: filtros de analítica")
else: print("OK globals.css: filtros ya aplicados")

# ---------------------------------------------------------------------------
# 6. Contenidos: el organizador solo retira o renombra lo suyo
# ---------------------------------------------------------------------------
ca = "app/api/content-assets/route.ts"; s = read(ca)
if "canManage" not in s:
    old = '''  return NextResponse.json({
    data: {
      assets: registered,'''
    if old not in s: print("ERROR content api: GET"); sys.exit(1)
    s = s.replace(old, '''  // El organizador solo puede retirar o renombrar lo que subió; el
  // administrador, todo.
  const isAdmin = auth.user.role === "administrator";
  return NextResponse.json({
    data: {
      assets: registered.map((asset) => ({
        ...asset,
        canManage: isAdmin || asset.createdBy === auth.user.id,
      })),''', 1)
    old = '''  const db = getDb();
  const [removed] = await db
    .delete(contentAssets)
    .where(eq(contentAssets.id, id))
    .returning();
  if (!removed) {
    return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });
  }'''
    if old not in s: print("ERROR content api: DELETE"); sys.exit(1)
    s = s.replace(old, '''  const db = getDb();
  const [target] = await db.select().from(contentAssets).where(eq(contentAssets.id, id)).limit(1);
  if (!target) {
    return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });
  }
  if (auth.user.role !== "administrator" && target.createdBy !== auth.user.id) {
    return NextResponse.json(
      { error: "Solo quien subió este contenido o un administrador puede retirarlo." },
      { status: 403 },
    );
  }
  const [removed] = await db
    .delete(contentAssets)
    .where(eq(contentAssets.id, id))
    .returning();
  if (!removed) {
    return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });
  }''', 1)
    old = '''  if (!asset) return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });

  const s3 = readS3Config();'''
    if old not in s: print("ERROR content api: PATCH"); sys.exit(1)
    s = s.replace(old, '''  if (!asset) return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });
  if (auth.user.role !== "administrator" && asset.createdBy !== auth.user.id) {
    return NextResponse.json(
      { error: "Solo quien subió este contenido o un administrador puede renombrarlo." },
      { status: 403 },
    );
  }

  const s3 = readS3Config();''', 1)
    write(ca, s); print(f"OK {ca}: alcance por autor")
else: print(f"OK {ca}: ya aplicado")

cl = "app/content/content-library.tsx"; s = read(cl)
if "canManage" not in s:
    s = s.replace("  durationSeconds: number | null;\n  createdAt: string;\n};", "  durationSeconds: number | null;\n  createdAt: string;\n  canManage?: boolean;\n};", 1)
    old = '''                <button className="content-remove" onClick={() => void remove(asset)}>
                  Retirar
                </button>'''
    if old not in s: print("ERROR content ui: retirar"); sys.exit(1)
    s = s.replace(old, '''                {asset.canManage !== false ? (
                  <button className="content-remove" onClick={() => void remove(asset)}>
                    Retirar
                  </button>
                ) : (
                  <small className="content-owner-note" title="Lo subió otro miembro del equipo">Solo lectura</small>
                )}''', 1)
    old = '            <label className="content-rename">'
    if old not in s: print("ERROR content ui: rename"); sys.exit(1)
    s = s.replace(old, '            {selected.canManage !== false && (\n            <label className="content-rename">', 1)
    old = '''              <small>El cambio se aplica también al archivo en Amazon S3; los eventos que lo usan no se ven afectados.</small>
            </label>
            <div className="content-preview-actions">
              <button className="content-remove" disabled={renaming} onClick={() => { void remove(selected); setSelected(null); }}>Retirar de la biblioteca</button>
            </div>'''
    if old not in s: print("ERROR content ui: acciones"); sys.exit(1)
    s = s.replace(old, '''              <small>El cambio se aplica también al archivo en Amazon S3; los eventos que lo usan no se ven afectados.</small>
            </label>
            )}
            {selected.canManage !== false ? (
              <div className="content-preview-actions">
                <button className="content-remove" disabled={renaming} onClick={() => { void remove(selected); setSelected(null); }}>Retirar de la biblioteca</button>
              </div>
            ) : (
              <p className="content-owner-note">Este contenido lo subió otro miembro del equipo: solo un administrador o quien lo subió puede renombrarlo o retirarlo.</p>
            )}''', 1)
    write(cl, s); print(f"OK {cl}: alcance por autor")
else: print(f"OK {cl}: ya aplicado")
g = css.read_text(encoding="utf-8")
if ".content-owner-note" not in g:
    g = g.rstrip("\n") + "\n\n.content-owner-note { color: #8e8998; font-size: 12px; margin: 0; }\n"
    css.write_text(g, encoding="utf-8"); print("OK globals.css: nota de autor")


# ---------------------------------------------------------------------------
# 4. Equipo: editar nombre y correo, reenviar credenciales
# ---------------------------------------------------------------------------
tn = "lib/team-notifications.ts"; s = read(tn)
if "credentials_resent" not in s:
    s = s.replace('export type TeamAccessKind = "created" | "promoted" | "role_changed" | "password_reset";', 'export type TeamAccessKind = "created" | "promoted" | "role_changed" | "password_reset" | "credentials_resent" | "email_changed";', 1)
    old = '''    case "password_reset":
      subject = `Nueva contraseña temporal para ${organization}`;
      intro = `Se restableció la contraseña de tu cuenta en ${organization}.`;
      break;
  }'''
    if old not in s: print("ERROR team-notifications: switch"); sys.exit(1)
    s = s.replace(old, '''    case "password_reset":
      subject = `Nueva contraseña temporal para ${organization}`;
      intro = `Se restableció la contraseña de tu cuenta en ${organization}.`;
      break;
    case "credentials_resent":
      subject = `Tus credenciales de acceso a ${organization}`;
      intro = `Te reenviamos el acceso a ${organization} con el rol de ${roleLabel}. Usa la contraseña temporal de abajo para entrar.`;
      break;
    case "email_changed":
      subject = `Tu correo de acceso a ${organization} cambió`;
      intro = `Un administrador actualizó el correo con el que entras a ${organization}: a partir de ahora usa ${options.to}. Tu contraseña no cambió.`;
      break;
  }''', 1)
    write(tn, s); print(f"OK {tn}: nuevos correos")
else: print(f"OK {tn}: ya aplicado")

tr = "app/api/team/route.ts"; s = read(tr)
if "resendCredentials" not in s:
    s = s.replace('import { and, count, eq, inArray } from "drizzle-orm";', 'import { and, count, eq, inArray, ne } from "drizzle-orm";', 1)
    s = s.replace('import { hashPassword } from "@/lib/password";', 'import { randomBytes } from "node:crypto";\nimport { hashPassword } from "@/lib/password";', 1)
    old = '''  const body = (await request.json()) as {
    id?: string;
    role?: StaffRole | "participant";
    active?: boolean;
    password?: string;
  };
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json(
      { error: "Miembro no válido." },
      { status: 400 },
    );
  }'''
    if old not in s: print("ERROR team route: body"); sys.exit(1)
    s = s.replace(old, '''  const body = (await request.json()) as {
    id?: string;
    role?: StaffRole | "participant";
    active?: boolean;
    password?: string;
    name?: string;
    email?: string;
    resendCredentials?: boolean;
  };
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json(
      { error: "Miembro no válido." },
      { status: 400 },
    );
  }
  // Reenviar credenciales: el servidor genera la contraseña temporal.
  if (body.resendCredentials) {
    const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(10);
    body.password = `Live!${Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("")}7`;
  }''', 1)
    old = '''  let role: AnyRole = target.role as StaffRole;
  let passwordHash = target.passwordHash;
  try {
    if (body.role !== undefined) role = cleanAnyRole(body.role);'''
    if old not in s: print("ERROR team route: validación"); sys.exit(1)
    s = s.replace(old, '''  let role: AnyRole = target.role as StaffRole;
  let passwordHash = target.passwordHash;
  let name = target.name;
  let email = target.email;
  try {
    if (body.name !== undefined) name = cleanName(body.name);
    if (body.email !== undefined) email = cleanEmail(body.email);
    if (body.role !== undefined) role = cleanAnyRole(body.role);''', 1)
    old = '''  const active = body.active ?? target.active;
  const removesActiveAdministrator ='''
    if old not in s: print("ERROR team route: active"); sys.exit(1)
    s = s.replace(old, '''  if (email !== target.email) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, target.id)))
      .limit(1);
    if (taken) {
      return NextResponse.json(
        { error: "Ese correo ya pertenece a otra cuenta." },
        { status: 409 },
      );
    }
  }

  const active = body.active ?? target.active;
  const removesActiveAdministrator =''', 1)
    old = '''    .set({
      role,
      active,
      passwordHash,'''
    if old not in s: print("ERROR team route: set"); sys.exit(1)
    s = s.replace(old, '''    .set({
      name,
      email,
      role,
      active,
      passwordHash,''', 1)
    old = '''  if (body.password !== undefined || !active || role !== target.role) {
    await db.delete(authSessions).where(eq(authSessions.userId, target.id));
  }'''
    if old not in s: print("ERROR team route: sesiones"); sys.exit(1)
    s = s.replace(old, '''  if (body.password !== undefined || !active || role !== target.role || email !== target.email) {
    await db.delete(authSessions).where(eq(authSessions.userId, target.id));
  }''', 1)
    old = '''      passwordReset: body.password !== undefined,
    },
    request,
  });
  if (role !== target.role || body.password !== undefined) {
    const kind = role !== target.role ? "role_changed" : "password_reset";'''
    if old not in s: print("ERROR team route: auditoría"); sys.exit(1)
    s = s.replace(old, '''      passwordReset: body.password !== undefined,
      credentialsResent: Boolean(body.resendCredentials),
      previousName: target.name,
      name,
      previousEmail: target.email,
      email,
    },
    request,
  });
  if (role !== target.role || body.password !== undefined || email !== target.email) {
    const kind = body.resendCredentials
      ? "credentials_resent"
      : role !== target.role
        ? "role_changed"
        : body.password !== undefined
          ? "password_reset"
          : "email_changed";''', 1)
    old = "  return NextResponse.json({ data: safeMember(updated) });\n}\n\nexport async function DELETE"
    if old not in s: print("ERROR team route: respuesta"); sys.exit(1)
    s = s.replace(old, '''  return NextResponse.json({
    data: safeMember(updated),
    temporaryPassword: body.resendCredentials ? body.password ?? null : null,
  });
}

export async function DELETE''', 1)
    write(tr, s); print(f"OK {tr}: editar y reenviar")
else: print(f"OK {tr}: ya aplicado")

tm = "app/team/team-manager.tsx"; s = read(tm)
if "editMember" not in s:
    s = s.replace("  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);", "  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);\n  const [editMember, setEditMember] = useState<TeamMember | null>(null);\n  const [editName, setEditName] = useState(\"\");\n  const [editEmail, setEditEmail] = useState(\"\");", 1)
    old = '''    changes: { role?: AssignableRole; active?: boolean; password?: string },
  ) => {'''
    if old not in s: print("ERROR team ui: patchMember"); sys.exit(1)
    s = s.replace(old, '''    changes: {
      role?: AssignableRole;
      active?: boolean;
      password?: string;
      name?: string;
      email?: string;
      resendCredentials?: boolean;
    },
  ) => {''', 1)
    old = '''    const payload = (await response.json()) as {
      data?: TeamMember;
      error?: string;
    };
    if (response.ok && payload.data) {
      // Al volver a participante, la persona sale del equipo (conserva su historial).'''
    if old not in s: print("ERROR team ui: payload"); sys.exit(1)
    s = s.replace(old, '''    const payload = (await response.json().catch(() => ({}))) as {
      data?: TeamMember;
      temporaryPassword?: string | null;
      error?: string;
    };
    if (response.ok && payload.data) {
      // Al volver a participante, la persona sale del equipo (conserva su historial).''', 1)
    old = '''      setMessage(
        changes.password
          ? `La contraseña de ${member.name} fue restablecida y se le envió por correo.`'''
    if old not in s: print("ERROR team ui: mensaje"); sys.exit(1)
    s = s.replace(old, '''      setMessage(
        changes.resendCredentials
          ? `${member.name} recibió de nuevo sus credenciales por correo.`
          : changes.name !== undefined || changes.email !== undefined
            ? `Datos de ${payload.data.name} actualizados${changes.email !== undefined && changes.email !== member.email ? "; se le avisó al nuevo correo" : ""}.`
          : changes.password
          ? `La contraseña de ${member.name} fue restablecida y se le envió por correo.`''', 1)
    old = '''      if (changes.password) {
        setCreatedAccess({
          name: member.name,
          email: member.email,
          password: changes.password,
        });
        setResetMember(null);
      }'''
    if old not in s: print("ERROR team ui: createdAccess"); sys.exit(1)
    s = s.replace(old, '''      if (changes.password) {
        setCreatedAccess({
          name: member.name,
          email: member.email,
          password: changes.password,
        });
        setResetMember(null);
      }
      if (changes.resendCredentials && payload.temporaryPassword) {
        setCreatedAccess({
          name: payload.data.name,
          email: payload.data.email,
          password: payload.temporaryPassword,
        });
        setEditMember(null);
        setInviteOpen(true);
      }
      if (changes.name !== undefined || changes.email !== undefined) setEditMember(null);''', 1)
    old = '''                <div className="team-actions">
                  <button
                    disabled={isCurrent || saving === member.id}
                    onClick={() => {
                      setGeneratedPassword(temporaryPassword());'''
    if old not in s: print("ERROR team ui: acciones"); sys.exit(1)
    s = s.replace(old, '''                <div className="team-actions">
                  <button
                    disabled={saving === member.id}
                    onClick={() => {
                      setEditName(member.name);
                      setEditEmail(member.email);
                      setEditMember(member);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    disabled={isCurrent || saving === member.id}
                    onClick={() => {
                      setGeneratedPassword(temporaryPassword());''', 1)
    old = "      {resetMember && (\n        <div className=\"modal-backdrop\" onMouseDown={() => setResetMember(null)}>"
    if old not in s: print("ERROR team ui: modal reset"); sys.exit(1)
    s = s.replace(old, '''      {editMember && (
        <div className="modal-backdrop" onMouseDown={() => saving !== editMember.id && setEditMember(null)}>
          <section className="modal team-modal" role="dialog" aria-modal="true" aria-labelledby="team-edit-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" disabled={saving === editMember.id} onClick={() => setEditMember(null)} aria-label="Cerrar">×</button>
            <span className="modal-icon">♧</span>
            <p className="eyebrow">EDITAR MIEMBRO</p>
            <h2 id="team-edit-title">Datos de {editMember.name}</h2>
            <p>Si cambias el correo, la persona entrará con el nuevo y recibirá un aviso. Sus sesiones abiertas se cierran.</p>
            <form
              className="team-invite-form"
              onSubmit={(event) => {
                event.preventDefault();
                const changes: { name?: string; email?: string } = {};
                if (editName.trim() !== editMember.name) changes.name = editName.trim();
                if (editEmail.trim().toLowerCase() !== editMember.email) changes.email = editEmail.trim().toLowerCase();
                if (Object.keys(changes).length === 0) {
                  setEditMember(null);
                  return;
                }
                void patchMember(editMember, changes);
              }}
            >
              <label>Nombre completo<input value={editName} onChange={(input) => setEditName(input.target.value)} required minLength={2} maxLength={100} autoComplete="off" /></label>
              <label>Correo electrónico<input type="email" value={editEmail} onChange={(input) => setEditEmail(input.target.value)} required maxLength={254} autoComplete="off" disabled={editMember.id === currentUserId} /></label>
              {editMember.id === currentUserId && <small className="team-edit-note">Tu propio correo de acceso no se cambia desde aquí.</small>}
              <button className="primary-button" disabled={saving === editMember.id}>{saving === editMember.id ? "Guardando…" : "Guardar cambios"}</button>
            </form>
            {editMember.id !== currentUserId && (
              <div className="team-edit-secondary">
                <p>¿Perdió el acceso? Genera una contraseña temporal nueva y envíasela por correo junto con el enlace de ingreso.</p>
                <button type="button" className="secondary-action" disabled={saving === editMember.id} onClick={() => void patchMember(editMember, { resendCredentials: true })}>
                  Reenviar credenciales por correo
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {resetMember && (
        <div className="modal-backdrop" onMouseDown={() => setResetMember(null)}>''', 1)
    write(tm, s); print(f"OK {tm}: editar y reenviar")
else: print(f"OK {tm}: ya aplicado")
g = css.read_text(encoding="utf-8")
if ".team-edit-secondary" not in g:
    g = g.rstrip("\n") + "\n\n.team-edit-secondary { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line, #e6e3ec); display: grid; gap: 10px; }\n.team-edit-secondary p, .team-edit-note { margin: 0; font-size: 13px; color: #6f6b7c; }\n"
    css.write_text(g, encoding="utf-8"); print("OK globals.css: edición de equipo")


# ---------------------------------------------------------------------------
# 2b. Centro de ayuda y widget en el idioma del usuario
# ---------------------------------------------------------------------------
patch("app/components/help-widget.tsx", [(
'  const [locale, setLocale] = useState<HelpLocale>("es");',
'''  const [locale, setLocale] = useState<HelpLocale>("es");
  // Arranca en el idioma elegido por el usuario en su perfil (<html lang>).
  useEffect(() => {
    const lang = document.documentElement.lang;
    if (lang === "en" || lang === "fr") setLocale(lang);
  }, []);''')], "document.documentElement.lang", optional=True)
hw = read("app/components/help-widget.tsx")
if 'import { useState } from "react";' in hw and "useEffect" in hw and "useEffect }" not in hw:
    write("app/components/help-widget.tsx", hw.replace('import { useState } from "react";', 'import { useEffect, useState } from "react";', 1)); print("OK help-widget: import useEffect")
sbs = read("app/components/admin-sidebar.tsx")
if 'href="/help" className="help-card help-card-link"' in sbs:
    sbs = sbs.replace('href="/help" className="help-card help-card-link"', 'href={user.locale === "en" ? "/help?lang=en" : "/help"} className="help-card help-card-link"', 1)
    write("app/components/admin-sidebar.tsx", sbs); print("OK admin-sidebar: ayuda en el idioma del usuario")
else: print("OK admin-sidebar: ayuda ya aplicada")

print("LISTO suite de administración")
