#!/usr/bin/env python3
"""Aviso "Ya estamos en vivo": tipo live_now en tipos de comunicación, etiqueta
en la pestaña Comunicaciones y copia de archivos propios."""
import glob, os, re, shutil
SRC = os.environ.get("SRC", "/tmp/icazalive-feat-aws-ivs-s3")
if os.path.isdir(SRC):
    for rel in ["lib/live-notifications.ts", "lib/default-communications.ts", "lib/communication-worker.ts",
                "lib/simulated-emitter.ts", "app/api/events/[slug]/route.ts", "app/api/events/[slug]/communications/route.ts",
                "app/api/public/events/[slug]/room/route.ts", "app/api/public/events/[slug]/register/route.ts",
                "app/api/participants/invite/route.ts"]:
        os.makedirs(os.path.dirname(rel), exist_ok=True)
        shutil.copyfile(os.path.join(SRC, rel), rel); print("copiado", rel)

UNION = re.compile(r'"registration_confirmation"\s*\|\s*"reminder_24h"\s*\|\s*"reminder_1h"\s*\|\s*"post_event"')
NEW = '"registration_confirmation" | "reminder_24h" | "reminder_1h" | "live_now" | "post_event"'
files = [f for f in glob.glob("app/**/*.ts*", recursive=True) + glob.glob("lib/**/*.ts", recursive=True) + glob.glob("scripts/*.ts") + ["db/schema.ts"]]
for f in files:
    s = open(f, encoding="utf-8").read(); t = UNION.sub(NEW, s)
    if t != s: open(f, "w", encoding="utf-8").write(t); print("unión ampliada", f)

p = "db/schema.ts"; s = open(p, encoding="utf-8").read()
t = s.replace('  "reminder_1h",\n  "post_event",\n]);', '  "reminder_1h",\n  "live_now",\n  "post_event",\n]);', 1)
if t != s: open(p, "w", encoding="utf-8").write(t); print("enum ampliado db/schema.ts")

p = "app/events/[slug]/event-detail.tsx"; s = open(p, encoding="utf-8").read()
# En Replit los iconos están tipados (AdminIconName): se reutiliza el de la confirmación.
m = re.search(r'registration_confirmation: \{[^}]*?icon: "([^"]+)"', s)
icon = m.group(1) if (m and "AdminIconName" in s) else "●"
if "live_now:" not in s:
    t = re.sub(r'(\n\s*post_event: \{\n\s*title: "Seguimiento posterior",)',
               lambda mm: '\n  live_now: {\n    title: "Ya estamos en vivo",\n    timing: "Al pasar el evento a En vivo",\n    icon: "' + icon + '",\n  },' + mm.group(1), s, count=1)
else:
    t = re.sub(r'(live_now: \{[^}]*?icon: )"●"', lambda mm: mm.group(1) + '"' + icon + '"', s, count=1)
if t != s: open(p, "w", encoding="utf-8").write(t); print("etiqueta live_now en event-detail")
if "live_now:" not in open(p, encoding="utf-8").read(): print("FALLO: no se insertó la etiqueta live_now"); raise SystemExit(1)
print("LISTO")
