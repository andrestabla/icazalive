#!/usr/bin/env python3
"""Alcance por organizador y creación desde /events:
- GET /api/events: el organizador solo ve sus eventos; el administrador ve todos y
  puede filtrar con ?organizer=<userId>; la respuesta incluye la lista de organizadores.
- GET /api/participants: el organizador solo ve inscritos de sus eventos.
- /events: "Crear evento" abre un modal en la misma página (app/events/event-creator.tsx,
  se copia completo) y el administrador tiene un filtro por organizador.
Anclado e idempotente."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def read(rel): return (root / rel).read_text(encoding="utf-8")
def write(rel, s): (root / rel).write_text(s, encoding="utf-8")
def patch(rel, pairs, marker):
    s = read(rel)
    if marker in s: print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if old not in s: print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
        s = s.replace(old, new, 1)
    write(rel, s); print(f"OK {rel}: aplicado")

# ---------------------------------------------------------------------------
# 1. Alcance de eventos y filtro por organizador
# ---------------------------------------------------------------------------
ev = "app/api/events/route.ts"; s = read(ev)
if "managedEventIds" not in s:
    s = s.replace('import { asc, eq } from "drizzle-orm";', 'import { asc, eq, inArray, ne, or } from "drizzle-orm";', 1)
    if "  users,\n} from \"@/db/schema\";" not in s and re.search(r'^\} from "@/db/schema";', s, flags=re.M):
        s = re.sub(r'\n\} from "@/db/schema";', '\n  users,\n} from "@/db/schema";', s, count=1)
    old = '''export async function GET() {
  if (!(await requireApiUser())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const db = getDb();
  const records = await db
    .select({'''
    new = '''export async function GET(request: Request) {
  const currentUser = await requireApiUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const db = getDb();
  // Alcance: el organizador solo ve los eventos donde figura como organizador
  // (o que creó); el administrador ve todos y puede filtrar por organizador.
  const organizerParam = new URL(request.url).searchParams.get("organizer")?.trim() || null;
  const scopeUserId =
    currentUser.role === "administrator" ? organizerParam : currentUser.id;
  const managedEventIds = scopeUserId
    ? db.select({ id: eventOrganizers.eventId }).from(eventOrganizers).where(eq(eventOrganizers.userId, scopeUserId))
    : null;
  const scope = scopeUserId && managedEventIds
    ? or(inArray(events.id, managedEventIds), eq(events.createdBy, scopeUserId))
    : undefined;
  const records = await db
    .select({'''
    assert old in s, "events GET: cabecera"
    s = s.replace(old, new, 1)
    old2 = '''    .from(events)
    .orderBy(asc(events.startsAt));

  return NextResponse.json({ data: attachScheduleConflicts(records) });
}'''
    new2 = '''    .from(events)
    .where(scope)
    .orderBy(asc(events.startsAt));

  // Lista de organizadores para el filtro del administrador.
  const organizers =
    currentUser.role === "administrator"
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(and(ne(users.role, "participant"), eq(users.active, true)))
          .orderBy(asc(users.name))
      : [];

  return NextResponse.json({ data: attachScheduleConflicts(records), organizers });
}'''
    assert old2 in s, "events GET: cierre"
    s = s.replace(old2, new2, 1)
    if not re.search(r'import \{[^}]*\band\b[^}]*\} from "drizzle-orm";', s):
        s = s.replace('import { asc, eq, inArray, ne, or } from "drizzle-orm";', 'import { and, asc, eq, inArray, ne, or } from "drizzle-orm";', 1)
    write(ev, s); print(f"OK {ev}: alcance por organizador")
else: print(f"OK {ev}: ya aplicado")

# ---------------------------------------------------------------------------
# 2. Alcance de participantes
# ---------------------------------------------------------------------------
pa = "app/api/participants/route.ts"; s = read(pa)
if "managedEventIds" not in s:
    s = s.replace('import { desc, eq, inArray } from "drizzle-orm";', 'import { desc, eq, inArray, or } from "drizzle-orm";', 1)
    if "eventOrganizers" not in s.split('} from "@/db/schema";')[0]:
        s = s.replace("import {\n  eventRegistrationFields,", "import {\n  eventOrganizers,\n  eventRegistrationFields,", 1)
    old = '''export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const db = getDb();
  const records = await db
    .select({'''
    new = '''export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const db = getDb();
  // Alcance: el organizador solo ve inscritos de los eventos que gestiona.
  const scopeUserId = auth.currentUser.role === "administrator" ? null : auth.currentUser.id;
  const managedEventIds = scopeUserId
    ? db.select({ id: eventOrganizers.eventId }).from(eventOrganizers).where(eq(eventOrganizers.userId, scopeUserId))
    : null;
  const scope = scopeUserId && managedEventIds
    ? or(inArray(registrations.eventId, managedEventIds), eq(events.createdBy, scopeUserId))
    : undefined;
  const records = await db
    .select({'''
    assert old in s, "participants GET: cabecera"
    s = s.replace(old, new, 1)
    old2 = '''    .innerJoin(events, eq(registrations.eventId, events.id))
    .orderBy(desc(registrations.registeredAt));'''
    assert old2 in s, "participants GET: join"
    s = s.replace(old2, '''    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(scope)
    .orderBy(desc(registrations.registeredAt));''', 1)
    write(pa, s); print(f"OK {pa}: alcance por organizador")
else: print(f"OK {pa}: ya aplicado")

# ---------------------------------------------------------------------------
# 3. Lista de eventos: modal de creación y filtro por organizador
# ---------------------------------------------------------------------------
el = "app/events/events-list.tsx"; s = read(el)
if "EventCreator" not in s:
    s = s.replace('import "./events-actions.css";', 'import "./events-actions.css";\nimport EventCreator from "./event-creator";', 1)
    # estado
    old = "  const [isAdmin, setIsAdmin] = useState(false);"
    assert old in s, "events-list: isAdmin"
    s = s.replace(old, old + '''
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [organizerFilter, setOrganizerFilter] = useState("");
  const [organizers, setOrganizers] = useState<{ id: string; name: string; email: string }[]>([]);''', 1)
    # loadEvents con filtro
    old = '''  const loadEvents = async () => {
    const response = await fetch("/api/events", { cache: "no-store" });
    const payload = (await response.json()) as {
      data?: EventRecord[];
      error?: string;
    };
    if (response.ok && payload.data) setEvents(payload.data);
    setLoading(false);
  };'''
    new = '''  const loadEvents = async (organizerId: string = organizerFilter) => {
    const query = organizerId ? `?organizer=${encodeURIComponent(organizerId)}` : "";
    const response = await fetch(`/api/events${query}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      data?: EventRecord[];
      organizers?: { id: string; name: string; email: string }[];
      error?: string;
    };
    if (response.ok && payload.data) {
      setEvents(payload.data);
      if (payload.organizers) setOrganizers(payload.organizers);
    }
    setLoading(false);
  };'''
    assert old in s, "events-list: loadEvents"
    s = s.replace(old, new, 1)
    old = '''  useEffect(() => {
    let cancelled = false;
    void fetch("/api/events", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: EventRecord[];
        };
        if (!cancelled && response.ok && payload.data) {
          setEvents(payload.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);'''
    assert old in s, "events-list: efecto inicial"
    s = s.replace(old, '''  useEffect(() => {
    void loadEvents(organizerFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizerFilter]);''', 1)
    # botón crear → modal
    # El botón puede tener variantes (icono, texto): se reemplaza el enlace completo.
    m = re.search(r'<Link href="/" className="primary-button link-button">([\s\S]*?)</Link>\n(\s*)</header>', s)
    assert m, "events-list: botón crear"
    inner = m.group(1)
    s = s[:m.start()] + '''<button type="button" className="primary-button" onClick={() => setCreatorOpen(true)}>''' + inner + '''</button>
''' + m.group(2) + '''</header>
      <EventCreator
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onCreated={(created) => {
          setCreatorOpen(false);
          void loadEvents();
          setNotice({ text: `“${created.title}” quedó creado como borrador.`, slug: created.slug });
        }}
      />''' + s[m.end():]
    # filtro por organizador (solo administrador)
    old = '''        <div className="event-view-switch" aria-label="Vista de eventos">'''
    assert old in s, "events-list: view switch"
    s = s.replace(old, '''        {isAdmin && organizers.length > 0 && (
          <label className="filter-select">
            <span>Organizador</span>
            <select value={organizerFilter} onChange={(event) => setOrganizerFilter(event.target.value)}>
              <option value="">Todos</option>
              {organizers.map((organizer) => (
                <option value={organizer.id} key={organizer.id}>{organizer.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="event-view-switch" aria-label="Vista de eventos">''', 1)
    write(el, s); print(f"OK {el}: modal de creación y filtro")
else: print(f"OK {el}: ya aplicado")

css = root / "app/globals.css"; g = css.read_text(encoding="utf-8")
if ".create-modal .event-options" not in g:
    g = g.rstrip("\n") + """

/* Modal de creación de eventos en /events. */
.create-modal { width: min(560px, 100%); }
.create-modal .event-options { margin-top: 14px; }
.create-modal .event-form { margin-top: 14px; }
"""
    css.write_text(g, encoding="utf-8"); print("OK globals.css: modal de creación")
else: print("OK globals.css: ya aplicado")
print("LISTO alcance y creación")
