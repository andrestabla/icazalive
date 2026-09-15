#!/usr/bin/env python3
"""Enlace de agendamiento (Calendly) en el editor del seguimiento posterior.
Ediciones ancladas en app/events/[slug]/event-detail.tsx (archivo divergente en
Replit) y en app/api/auth/me/route.ts. Idempotente."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def sub(text, pattern, repl, etiqueta, flags=re.S):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", etiqueta); sys.exit(1)
    return new

p = root / "app/events/[slug]/event-detail.tsx"
s = p.read_text()
if "scheduling-link" not in s:
    s = sub(s, r'(import "\.\./broadcast-details\.css";\n)',
            lambda m: m.group(1) + 'import "../scheduling-link.css";\n', "import css")
    s = sub(s, r'(  const \[broadcastRevealed, setBroadcastRevealed\] = useState\(false\);\n)',
            lambda m: m.group(1) + '''  // Enlace de agendamiento (Calendly): el del evento (propietario) y el propio.
  const [schedulingLink, setSchedulingLink] = useState<{
    eventUrl: string | null;
    ownerName: string | null;
    mine: string | null;
  } | null>(null);
  const [mySchedulingUrl, setMySchedulingUrl] = useState("");
  const [schedulingNotice, setSchedulingNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [schedulingSaving, setSchedulingSaving] = useState(false);
  const loadSchedulingLink = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${event.slug}/scheduling-link`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: { eventUrl: string | null; ownerName: string | null; mine: string | null } };
      if (response.ok && payload.data) {
        setSchedulingLink(payload.data);
        setMySchedulingUrl(payload.data.mine ?? "");
      }
    } catch {
      // Se reintenta al guardar.
    }
  }, [event.slug]);
  useEffect(() => {
    void loadSchedulingLink();
  }, [loadSchedulingLink]);
  const saveSchedulingUrl = async () => {
    setSchedulingSaving(true);
    setSchedulingNotice(null);
    try {
      const response = await fetch("/api/auth/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schedulingUrl: mySchedulingUrl.trim() || null }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSchedulingNotice({ text: payload.error ?? "No fue posible guardar el enlace.", error: true });
      } else {
        setSchedulingNotice({ text: mySchedulingUrl.trim() ? "Enlace guardado en tu perfil." : "Enlace retirado.", error: false });
        await loadSchedulingLink();
      }
    } catch {
      setSchedulingNotice({ text: "No fue posible contactar al servidor.", error: true });
    } finally {
      setSchedulingSaving(false);
    }
  };
''', "estado del enlace")
    # useCallback en el import de react
    m = re.search(r'import \{([^}]*)\} from "react";', s)
    if not m:
        print("ANCLA NO ENCONTRADA: import de react"); sys.exit(1)
    names = [n.strip() for n in m.group(1).split(",") if n.strip()]
    if "useCallback" not in names:
        names.append("useCallback")
        s = s[:m.start()] + 'import { ' + ", ".join(sorted(names)) + ' } from "react";' + s[m.end():]
    s = sub(s, r'(\.replaceAll\(\s*"\{\{calendar_link\}\}",\s*`[^`]*`,\s*\))',
            lambda m: m.group(1) + '\n      .replaceAll(\n        "{{schedule_link}}",\n        schedulingLink?.eventUrl ?? "https://calendly.com/tu-equipo/entrevista",\n      )',
            "vista previa")
    s = sub(s, r'(<span>\{"\{\{calendar_link\}\}"\}</span>\n)',
            lambda m: m.group(1) + '                    <span>{"{{schedule_link}}"}</span>\n', "chips")
    s = sub(s, r'(\n(\s*)<div className="template-tags">)',
            lambda m: f'''
{m.group(2)}{{selectedCommunication.type === "post_event" && (
{m.group(2)}  <div className="scheduling-link-box">
{m.group(2)}    <p className="eyebrow">AGENDAMIENTO · CALENDLY</p>
{m.group(2)}    <p>
{m.group(2)}      El seguimiento incluye el botón “Agendar una reunión” con el enlace del propietario del evento
{m.group(2)}      {{schedulingLink?.ownerName ? `(${{schedulingLink.ownerName}})` : ""}}. Cada organizador guarda el suyo aquí; usa{{" "}}
{m.group(2)}      <code>{{"{{{{schedule_link}}}}"}}</code> en el mensaje para ubicarlo.
{m.group(2)}    </p>
{m.group(2)}    <label>
{m.group(2)}      Tu enlace de Calendly
{m.group(2)}      <input
{m.group(2)}        type="url"
{m.group(2)}        value={{mySchedulingUrl}}
{m.group(2)}        onChange={{(input) => setMySchedulingUrl(input.target.value)}}
{m.group(2)}        placeholder="https://calendly.com/tu-usuario/entrevista"
{m.group(2)}      />
{m.group(2)}    </label>
{m.group(2)}    <div className="scheduling-link-actions">
{m.group(2)}      <button type="button" disabled={{schedulingSaving}} onClick={{() => void saveSchedulingUrl()}}>
{m.group(2)}        {{schedulingSaving ? "Guardando…" : "Guardar mi enlace"}}
{m.group(2)}      </button>
{m.group(2)}      {{schedulingNotice ? (
{m.group(2)}        <small className={{schedulingNotice.error ? "error" : "ok"}} role="status">{{schedulingNotice.text}}</small>
{m.group(2)}      ) : (
{m.group(2)}        <small>
{m.group(2)}          {{schedulingLink?.eventUrl
{m.group(2)}            ? `Este evento usará: ${{schedulingLink.eventUrl}}`
{m.group(2)}            : "Este evento aún no tiene enlace: el botón no aparecerá hasta que el propietario guarde el suyo."}}
{m.group(2)}        </small>
{m.group(2)}      )}}
{m.group(2)}    </div>
{m.group(2)}  </div>
{m.group(2)})}}''' + m.group(1),
            "bloque de agendamiento")
    p.write_text(s)
    print("OK event-detail.tsx: enlace de agendamiento")
else:
    print("OK event-detail.tsx: ya aplicado")

p = root / "app/api/auth/me/route.ts"
s = p.read_text()
if "schedulingUrl" not in s:
    s = sub(s, r'(\s+timezone: users\.timezone,\n)', lambda m: m.group(1) + '      schedulingUrl: users.schedulingUrl,\n', "select de me")
    s = sub(s, r'timezone: record\?\.timezone \?\? null \}', lambda m: 'timezone: record?.timezone ?? null, schedulingUrl: record?.schedulingUrl ?? null }', "respuesta de me")
    p.write_text(s)
    print("OK me/route.ts: schedulingUrl")
else:
    print("OK me/route.ts: ya aplicado")
print("LISTO scheduling-link")
