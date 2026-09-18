#!/usr/bin/env python3
"""Plantilla CSV de ejemplo en Invitar participantes. Parche anclado sobre la
versión de Replit del modal (con AdminIcon). Idempotente."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/participants/participant-inviter.tsx"; s = p.read_text()
def sub(text, pattern, repl, etiqueta):
    new, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", etiqueta); sys.exit(1)
    return new
if "csv-template" not in s:
    s = sub(s, r'^"use client";\n', lambda m: '"use client";\n\nimport "./csv-template.css";\n', "use client")
    s = sub(s, r'Crea accesos personales y prepara las comunicaciones en la cola\s+local\.', lambda m: 'Crea accesos personales y programa las comunicaciones del evento.', "intro")
    s = sub(s, r'(\n(\s*)<small>Máximo 2 MB · hasta 500 filas</small>\n\s*</label>\n)',
            lambda m: m.group(1) + f'''{m.group(2)[:-2]}<div className="csv-template-hint">
{m.group(2)[:-2]}  <a href="/plantilla-participantes.csv" download="plantilla-participantes.csv">
{m.group(2)[:-2]}    ↓ Descargar plantilla de ejemplo (CSV)
{m.group(2)[:-2]}  </a>
{m.group(2)[:-2]}  <small>
{m.group(2)[:-2]}    Columnas: <code>nombre</code>, <code>correo</code>, <code>empresa</code>, <code>cargo</code>, <code>telefono</code>.
{m.group(2)[:-2]}    Solo <b>nombre</b> y <b>correo</b> son obligatorios; las demás pueden quedar vacías. Guárdala como CSV UTF-8 (separado por comas o punto y coma).
{m.group(2)[:-2]}  </small>
{m.group(2)[:-2]}</div>
''', "bloque plantilla")
    p.write_text(s); print("OK participant-inviter.tsx: plantilla CSV")
else:
    print("OK participant-inviter.tsx: ya aplicado")
