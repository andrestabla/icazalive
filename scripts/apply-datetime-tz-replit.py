#!/usr/bin/env python3
"""Los campos de fecha/hora (crear evento, duplicar, sesiones) se interpretan
en la zona de la plataforma (Miami), no en la del navegador. Ediciones
ancladas e idempotentes sobre archivos que Replit pudo modificar."""
import os, re, shutil, sys
SRC = os.environ.get("SRC", "/tmp/icazalive-feat-aws-ivs-s3")
if os.path.isdir(SRC):
    shutil.copyfile(os.path.join(SRC, "lib/timezone.ts"), "lib/timezone.ts"); print("copiado lib/timezone.ts")

IMPORT = 'import { PLATFORM_TIMEZONE, platformLocalToDate, toPlatformDateTimeInput } from "@/lib/timezone";\n'
def ensure_import(s):
    s = s.replace('import { PLATFORM_TIMEZONE } from "@/lib/timezone";\n', IMPORT, 1)
    if "platformLocalToDate" not in s.split("export default")[0]:
        m = list(re.finditer(r'^import [^;]+;\n', s, re.M)); last = m[-1].end() if m else 0
        s = s[:last] + IMPORT + s[last:]
    return s

def dashboard(s):
    o = s
    s = s.replace('const startsAt = new Date(String(form.get("startsAt")));', 'const startsAt = platformLocalToDate(String(form.get("startsAt")));', 1)
    s = s.replace('''                    <label>
                      Fecha y hora
                      <input
                        name="startsAt"
                        type="datetime-local"''', '''                    <label>
                      Fecha y hora <small>hora de Miami</small>
                      <input
                        name="startsAt"
                        type="datetime-local"''', 1)
    return ensure_import(s) if s != o else s

def detail(s):
    o = s
    s = s.replace('''    const startsAt = new Date(String(form.get("startsAt")));
    const endsAt = new Date(String(form.get("endsAt")));''', '''    const startsAt = platformLocalToDate(String(form.get("startsAt")));
    const endsAt = platformLocalToDate(String(form.get("endsAt")));''', 1)
    s = re.sub(r'function toLocalDateTimeInput\(value: string\) \{\n  const date = new Date\(value\);\n  const pad = [^\n]+\n  return `[^\n]+\n\}',
               'function toLocalDateTimeInput(value: string) {\n  return toPlatformDateTimeInput(value);\n}', s, count=1)
    return ensure_import(s) if s != o else s

def events_list(s):
    o = s
    s = s.replace('    const startsAt = new Date(duplicateStartsAt);', '    const startsAt = platformLocalToDate(duplicateStartsAt);', 1)
    s = re.sub(r'function toLocalDateTimeInput\(value: string\) \{\n  const date = new Date\(value\);\n  const pad = [^\n]+\n  return `[^\n]+\n\}',
               'function toLocalDateTimeInput(value: string) {\n  return toPlatformDateTimeInput(value);\n}', s, count=1)
    return ensure_import(s) if s != o else s

for path, fn in [("app/dashboard-client.tsx", dashboard), ("app/events/[slug]/event-detail.tsx", detail), ("app/events/events-list.tsx", events_list)]:
    s = open(path, encoding="utf-8").read(); t = fn(s)
    if t != s: open(path, "w", encoding="utf-8").write(t); print("ajustado", path)
    else: print("sin cambios", path)
for path in ["app/dashboard-client.tsx", "app/events/[slug]/event-detail.tsx", "app/events/events-list.tsx"]:
    s = open(path, encoding="utf-8").read()
    if "platformLocalToDate" not in s: print("FALLO: sin conversión en", path); sys.exit(1)
print("LISTO")
