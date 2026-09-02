#!/usr/bin/env python3
"""Nombre de la plataforma: "Icaza Live" -> "Icaza Jammoul Live" en textos
visibles (títulos, correos, plantillas, MFA, calendario). No toca slugs ni
identificadores (icaza-live, icazalive). Idempotente."""
import glob, re
files = [f for f in glob.glob("app/**/*.ts*", recursive=True) + glob.glob("lib/**/*.ts", recursive=True)
         if "/node_modules/" not in f]
changed = 0
for f in files:
    s = open(f, encoding="utf-8").read()
    t = re.sub(r"Icaza Live(?! ?Jammoul)(?!\w)", "Icaza Jammoul Live", s)
    t = t.replace("Icaza Jammoul Jammoul Live", "Icaza Jammoul Live")
    if t != s:
        open(f, "w", encoding="utf-8").write(t); changed += 1; print("ajustado", f)
print(f"LISTO: {changed} archivos")
