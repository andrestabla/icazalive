#!/usr/bin/env python3
"""Equipo: tabla sin scroll horizontal (columnas flexibles, acciones que se
envuelven y filas apiladas en pantallas estrechas). Idempotente."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/globals.css"; s = p.read_text(encoding="utf-8")
if ".team-table-head { display: none; }" in s:
    print("OK globals.css: equipo ya aplicado"); sys.exit(0)
old = """.team-table { overflow-x: auto; }
.team-table-head, .team-table > article { min-width: 870px; display: grid; grid-template-columns: minmax(220px, 1.35fr) 130px minmax(165px, 1fr) 80px 175px; gap: 15px; align-items: center; }"""
new = """.team-table { overflow: visible; }
.team-table-head, .team-table > article { display: grid; grid-template-columns: minmax(180px, 1.4fr) minmax(120px, 150px) minmax(140px, 1fr) 72px minmax(150px, auto); gap: 12px; align-items: center; }"""
assert old in s, "team-table"
s = s.replace(old, new, 1)
s = s.replace(".team-actions { display: flex; align-items: center; gap: 6px; }", ".team-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px; }", 1)
s = s.rstrip("\\n") + """

/* Equipo: en pantallas estrechas cada miembro ocupa una tarjeta de dos líneas. */
@media (max-width: 1100px) {
  .team-table-head { display: none; }
  .team-table > article { grid-template-columns: 1fr auto; grid-template-areas: "person status" "role access" "actions actions"; gap: 10px 14px; }
  .team-table > article > .team-person { grid-area: person; }
  .team-table > article > .team-status { grid-area: status; }
  .team-table > article > select, .team-table > article > .team-role { grid-area: role; max-width: 240px; }
  .team-table > article > .team-last-access { grid-area: access; }
  .team-table > article > .team-actions { grid-area: actions; justify-content: flex-start; }
}
"""
p.write_text(s, encoding="utf-8"); print("OK globals.css: equipo sin scroll")
