#!/usr/bin/env python3
"""Zona horaria única de la plataforma: America/New_York (Miami).
Barrido idempotente por regex sobre app/ y lib/: literales de Bogotá,
fechas sin zona explícita, default del esquema y textos de soporte."""
import glob, os, re, shutil, sys

SRC = os.environ.get("SRC", "/tmp/d/icazalive-feat-aws-ivs-s3")
if os.path.isdir(SRC):
    shutil.copyfile(os.path.join(SRC, "lib/timezone.ts"), "lib/timezone.ts")
    print("copiado lib/timezone.ts")

IMPORT = 'import { PLATFORM_TIMEZONE } from "@/lib/timezone";\n'
changed = 0

def ensure_import(s):
    if "PLATFORM_TIMEZONE" not in s or IMPORT in s: return s
    # después de la directiva "use client" y del primer bloque de imports
    m = list(re.finditer(r'^import [^;]+;\n', s, re.M))
    if m:
        last = m[-1].end()
        return s[:last] + IMPORT + s[last:]
    if s.startswith('"use client";'):
        i = s.index("\n") + 1
        return s[:i] + "\n" + IMPORT + s[i:]
    return IMPORT + s

files = [f for f in glob.glob("app/**/*.ts", recursive=True) + glob.glob("app/**/*.tsx", recursive=True)
         + glob.glob("lib/**/*.ts", recursive=True) if "/node_modules/" not in f and f != "lib/timezone.ts"]
for f in files:
    s = open(f, encoding="utf-8").read(); o = s
    s = s.replace('timeZone: "America/Bogota"', "timeZone: PLATFORM_TIMEZONE")
    # llamadas sin zona: toLocaleString("es-CO") y variantes
    s = re.sub(r'\.toLocale(Date|Time)?String\("es-CO"\)', r'.toLocale\1String("es-CO", { timeZone: PLATFORM_TIMEZONE })', s)
    s = re.sub(r'\.toLocale(Date|Time)?String\(\)', r'.toLocale\1String("es-CO", { timeZone: PLATFORM_TIMEZONE })', s)
    # Intl.DateTimeFormat("es-CO", {...}) sin timeZone dentro del objeto (una sola línea o multilínea corta)
    def add_tz(m):
        body = m.group(1)
        if "timeZone" in body: return m.group(0)
        return 'new Intl.DateTimeFormat("es-CO", {' + body.rstrip() + ("" if body.rstrip().endswith(",") else ",") + " timeZone: PLATFORM_TIMEZONE }"
    s = re.sub(r'new Intl\.DateTimeFormat\("es-CO", \{([^{}]*?)\}', add_tz, s, flags=re.S)
    s = s.replace("(America/Bogota)", "(hora de Miami)")
    if f == "lib/use-user-timezone.ts":
        s = s.replace('export const FALLBACK_TIMEZONE = "America/Bogota";', 'export const FALLBACK_TIMEZONE = PLATFORM_TIMEZONE;')
        s = re.sub(r'function browserTimezone\(\): string \{[\s\S]*?\n\}\n',
                   '// La plataforma opera en una sola zona horaria (Miami); la preferencia\n// personal del usuario, si la guardó, sigue teniendo prioridad.\nfunction browserTimezone(): string {\n  return PLATFORM_TIMEZONE;\n}\n', s, count=1)
    if f == "db/schema.ts":
        pass
    s = ensure_import(s)
    if s != o:
        open(f, "w", encoding="utf-8").write(s); changed += 1; print("ajustado", f)

# esquema: default de eventos
p = "db/schema.ts"; s = open(p, encoding="utf-8").read(); o = s
s = s.replace('timezone: text("timezone").notNull().default("America/Bogota")', 'timezone: text("timezone").notNull().default("America/New_York")')
if s != o: open(p, "w", encoding="utf-8").write(s); print("ajustado db/schema.ts")

# lista de zonas en preferencias: Miami primero
p = "app/components/account-security.tsx"
if os.path.exists(p):
    s = open(p, encoding="utf-8").read(); o = s
    if '  "America/New_York",\n  "America/Bogota",' not in s and '  "America/Bogota",\n' in s and '  "America/New_York",\n' in s:
        s = s.replace('  "America/New_York",\n', '', 1).replace('  "America/Bogota",\n', '  "America/New_York",\n  "America/Bogota",\n', 1)
    if s != o: open(p, "w", encoding="utf-8").write(s); print("ajustado account-security.tsx")

# TZ del proceso Node (fechas sin zona en el servidor)
p = ".env"
env = open(p, encoding="utf-8").read() if os.path.exists(p) else ""
if not re.search(r'^TZ=', env, re.M):
    open(p, "a", encoding="utf-8").write(("\n" if env and not env.endswith("\n") else "") + "TZ=America/New_York\nNEXT_PUBLIC_PLATFORM_TIMEZONE=America/New_York\n")
    print("ajustado .env (TZ)")
print(f"LISTO: {changed} archivos")

# ---- Segunda pasada: revertir los toLocaleString que eran de números --------
import subprocess, collections
def revert_numbers():
    out = subprocess.run(["npx", "tsc", "--noEmit", "-p", "."], capture_output=True, text=True).stdout
    hits = collections.defaultdict(list)
    for m in re.finditer(r'^(.+?)\((\d+),(\d+)\): error TS2769', out, re.M):
        hits[m.group(1)].append((int(m.group(2)), int(m.group(3))))
    for f, pos in hits.items():
        lines = open(f, encoding="utf-8").read().split("\n")
        for ln, col in sorted(set(pos), reverse=True):
            line = lines[ln - 1]
            needle = '"es-CO", { timeZone: PLATFORM_TIMEZONE }'
            i = line.find(needle, col - 1)
            if i < 0 or i > col + 2:
                i = line.rfind(needle, 0, col + len(needle))
            if i < 0: continue
            lines[ln - 1] = line[:i] + '"es-CO"' + line[i + len('"es-CO", { timeZone: PLATFORM_TIMEZONE }'):]
        s = "\n".join(lines)
        if s.count("PLATFORM_TIMEZONE") == 1 and IMPORT in s:
            s = s.replace(IMPORT, "")
        open(f, "w", encoding="utf-8").write(s)
        print("revertidos números en", f, len(set(pos)))
    return bool(hits)
if revert_numbers():
    rest = subprocess.run(["npx", "tsc", "--noEmit", "-p", "."], capture_output=True, text=True).stdout.strip()
    print("tsc:", "OK" if not rest else rest[:800])
