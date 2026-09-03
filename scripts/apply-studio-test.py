#!/usr/bin/env python3
"""Integra la prueba técnica real en la sala técnica (studio) con ediciones ancladas.
Funciona sobre la versión local y sobre la de Replit (que usa AdminIcon/ServiceLogo)."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def edit(path, pairs):
    p = root / path
    s = p.read_text()
    for pattern, repl, guard in pairs:
        if guard in s:
            continue
        new, n = re.subn(pattern, repl, s, count=1, flags=re.S)
        if n != 1:
            print(f"ANCLA NO ENCONTRADA en {path}: {pattern[:60]}")
            sys.exit(1)
        s = new
    p.write_text(s)
    print("ok", path)

edit("app/events/[slug]/studio/page.tsx", [
    (r"timezone: record\.event\.timezone,\n(\s*)\}\}",
     r"timezone: record.event.timezone,\n\1  status: record.event.status,\n\1  format: record.event.format,\n\1}}",
     "format: record.event.format,"),
    (r"playbackUrl: record\.session\.playbackUrl,\n(\s*)technicalCheckAt:",
     r"playbackUrl: record.session.playbackUrl,\n\1emitterStatus: record.session.emitterStatus,\n\1technicalCheckAt:",
     "emitterStatus: record.session.emitterStatus,"),
])

edit("app/events/[slug]/studio/studio-client.tsx", [
    (r'import \{ useState \} from "react";\n',
     'import { useState } from "react";\nimport StudioTechnicalTest from "./studio-technical-test";\n',
     "studio-technical-test"),
    (r"technicalCheckAt: string \| null;\n\};",
     'technicalCheckAt: string | null;\n  emitterStatus: "idle" | "starting" | "running" | "stopping" | "stopped" | "error";\n};',
     "emitterStatus:"),
    (r"event: \{ title: string; slug: string; timezone: string \};",
     "event: { title: string; slug: string; timezone: string; status: string; format: string };",
     "timezone: string; status: string; format: string"),
    (r'<div className="studio-stage">.*?</div>\n(\s*)<div className="studio-sources">',
     r'<StudioTechnicalTest event={event} session={session} />\n\1<div className="studio-sources">',
     "<StudioTechnicalTest"),
    (r'<p className="studio-safety-note">[^<]*</p>',
     '<p className="studio-safety-note">La revisión valida la configuración. La prueba técnica del escenario emite por Amazon IVS solo para el organizador: no cambia el estado del evento ni notifica a los inscritos; al llegar la hora, la automatización reinicia el contenido desde el comienzo.</p>',
     "La prueba técnica del escenario"),
])
