#!/usr/bin/env python3
"""Notificaciones: worker con reclamo por intentos; correos con botones
"Entrar al evento" y "Agendar en mi calendario"; sin enlace .ics en pantallas
públicas; cambio de fecha/hora en borrador o preparación."""
import os, re, shutil, sys
SRC = os.environ.get("SRC", "/tmp/icazalive-feat-aws-ivs-s3")
if os.path.isdir(SRC):
    for rel in ["lib/communication-worker.ts", "lib/communication-renderer.ts", "lib/default-communications.ts",
                "app/events/[slug]/event-date-editor.tsx", "app/api/events/[slug]/route.ts"]:
        os.makedirs(os.path.dirname(rel), exist_ok=True)
        shutil.copyfile(os.path.join(SRC, rel), rel); print("copiado", rel)

def edit(path, fn):
    s = open(path, encoding="utf-8").read(); t = fn(s)
    if t != s: open(path, "w", encoding="utf-8").write(t); print("ajustado", path)
    else: print("sin cambios", path)

def form(s):
    return re.sub(r'\n\s*\{calendarUrl && <a className="registration-manage-link" href=\{calendarUrl\}>Añadir al calendario \(\.ics\)</a>\}', '', s, count=1)

def manager(s):
    s = re.sub(r'\n\s*<a\s*\n\s*href=\{`/api/public/events/\$\{eventShell\.slug\}/calendar\?access=\$\{encodedToken\}`\}\s*\n\s*>\s*\n\s*Descargar calendario <span>[^<]*</span>\s*\n\s*</a>', '', s, count=1)
    s = re.sub(r'\n\s*<a\s*\n\s*href=\{`/api/public/events/\$\{eventShell\.slug\}/calendar\?access=\$\{encodedToken\}`\}\s*\n\s*>\s*\n\s*Descargar calendario <AdminIcon[^\n]*\n\s*</a>', '', s, count=1)
    return s.replace('Actualiza tus datos o descarga la invitación del calendario.', 'Actualiza tus datos de inscripción.', 1)

def detail(s):
    if "EventDateEditor" in s: return s
    s = s.replace('import RecordedVideoPanel from "./recorded-video-panel";', 'import EventDateEditor from "./event-date-editor";\nimport RecordedVideoPanel from "./recorded-video-panel";', 1)
    anchor = re.search(r'(\n(\s*)<p>◷ \{formatStableDateTime\(start, event\.timezone\)\}[^\n]*</p>)', s)
    if not anchor: print("FALLO: ancla de fecha en event-detail"); sys.exit(1)
    indent = anchor.group(2)
    insert = f'{anchor.group(1)}\n{indent}<EventDateEditor slug={{event.slug}} status={{event.status}} startsAt={{event.startsAt}} endsAt={{event.endsAt}} />'
    return s.replace(anchor.group(1), insert, 1)

edit("app/register/[slug]/registration-form.tsx", form)
edit("app/manage-registration/[slug]/registration-manager.tsx", manager)
edit("app/events/[slug]/event-detail.tsx", detail)

css_block = '''

/* Cambio de fecha del evento (borrador / preparación) */
.event-date-edit-toggle { margin-top: 6px; border: 1px solid #dfdce5; background: #fff; color: #4a3bb8; font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 8px; cursor: pointer; }
.event-date-edit-toggle:hover { background: #f6f3fd; }
.event-date-editor { display: grid; grid-template-columns: 1fr auto; gap: 10px 12px; align-items: end; margin-top: 8px; padding: 12px; border: 1px solid #e6e2ee; border-radius: 12px; background: #fbfafd; max-width: 560px; }
.event-date-editor label { display: grid; gap: 4px; font-size: 12px; font-weight: 600; color: #4a4657; }
.event-date-editor label small { font-weight: 500; color: #817b8d; }
.event-date-editor input, .event-date-editor select { padding: 7px 9px; border: 1px solid #dfdce5; border-radius: 8px; font-size: 13px; background: #fff; }
.event-date-editor-actions { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
.event-date-editor > small { grid-column: 1 / -1; color: #817b8d; font-size: 11px; }
.event-date-editor .form-error { grid-column: 1 / -1; margin: 0; }
'''
p = "app/globals.css"; s = open(p, encoding="utf-8").read()
if ".event-date-editor" not in s:
    open(p, "a", encoding="utf-8").write(css_block); print("anexado CSS fecha")
for path, marker in [("app/register/[slug]/registration-form.tsx", "Añadir al calendario (.ics)"), ("app/manage-registration/[slug]/registration-manager.tsx", "Descargar calendario")]:
    if marker in open(path, encoding="utf-8").read(): print("FALLO: sigue presente", marker, "en", path); sys.exit(1)
if "EventDateEditor" not in open("app/events/[slug]/event-detail.tsx", encoding="utf-8").read():
    print("FALLO: EventDateEditor no insertado"); sys.exit(1)
print("LISTO")
