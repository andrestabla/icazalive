#!/usr/bin/env python3
"""Equipo con notificaciones por correo y promoción de participantes;
Participantes agrupados por correo con historial; seed sin datos demo.
Copia archivos propios verificando por md5 que Replit no los modificó."""
import hashlib, os, shutil, subprocess, sys

SRC = os.environ.get("SRC", "/tmp/icazalive-feat-aws-ivs-s3")
def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest() if os.path.exists(p) else None

EXPECTED_OLD = {
    "app/participants/participants-list.tsx": "8215eb739cfd3d00e71a5fefae807bb2",
    "app/team/team-manager.tsx": "301dac19308d7c92b2de335211f49dec",
    "app/api/team/route.ts": "cc9d4c4cbc1b1e5deebf4192f8d0801e",
    "scripts/db-seed.ts": "e0827dc44b5dbc47d72b862150a61eb3",
}
NEW_FILES = ["lib/team-notifications.ts"]
MERGED = set()
# Archivos que el agente de Replit modificó (iconos): se parchean, no se copian.
PATCHED = {"app/participants/participants-list.tsx", "app/team/team-manager.tsx"}

problems = []
for rel in NEW_FILES + list(EXPECTED_OLD):
    src = os.path.join(SRC, rel)
    if not os.path.exists(src):
        problems.append(f"falta en el tarball: {rel}"); continue
    current = md5(rel)
    if current == md5(src):
        print("al día", rel); continue
    if rel in PATCHED and current is not None and current != EXPECTED_OLD[rel]:
        marker = "groupByEmail" if "participants" in rel else "AssignableRole"
        if marker in open(rel, encoding="utf-8").read():
            print("ya parcheado", rel); continue
        r = subprocess.run(["patch", "-p1", "--forward", "--fuzz=3", "--no-backup-if-mismatch", rel,
                            "-i", os.path.join(SRC, "scripts/patches/team-ui.patch")], capture_output=True, text=True)
        print(r.stdout.strip())
        if r.returncode != 0 or os.path.exists(rel + ".rej"):
            problems.append(f"parche con rechazos en {rel}: revisa {rel}.rej")
        else:
            print("parcheado", rel)
        continue
    if rel in EXPECTED_OLD and rel not in MERGED and current is not None and current != EXPECTED_OLD[rel]:
        problems.append(f"DIVERGIÓ en Replit (no se sobrescribe): {rel}"); continue
    os.makedirs(os.path.dirname(rel) or ".", exist_ok=True)
    shutil.copyfile(src, rel); print("copiado", rel)

css_src = open(os.path.join(SRC, "app/globals.css"), encoding="utf-8").read()
marker = "/* Participantes agrupados por correo e historial */"
block = css_src[css_src.index(marker):]
p = "app/globals.css"; s = open(p, encoding="utf-8").read()
if marker in s:
    s = s[:s.index(marker)] + block; open(p, "w", encoding="utf-8").write(s); print("actualizado CSS participantes")
else:
    open(p, "a", encoding="utf-8").write("\n\n" + block); print("anexado CSS participantes")

if problems:
    print("\n".join("FALLO: " + x for x in problems)); sys.exit(1)
print("LISTO")
