#!/usr/bin/env python3
"""Añade el import de login-brand.css al formulario de inicio de sesión (ancla tolerante)."""
import sys, pathlib, re
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/login/login-form.tsx"
s = p.read_text()
if "login-brand.css" in s:
    print("ya aplicado"); sys.exit(0)
m = re.match(r'\s*"use client";\s*\n', s)
if not m:
    print("ANCLA NO ENCONTRADA: \"use client\""); sys.exit(1)
s = s[:m.end()] + 'import "./login-brand.css";\n' + s[m.end():]
p.write_text(s)
print("ok", p)
