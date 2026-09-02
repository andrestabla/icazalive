#!/usr/bin/env python3
"""La sesión principal de un evento nace con el modo acorde al formato
(simulado -> contenido pregrabado; en vivo/híbrido -> Zoom → IVS) y la
lista de preparación describe el paso de transmisión según el formato."""
import os, sys
p = "app/api/events/route.ts"; s = open(p, encoding="utf-8").read()
old = '''    await transaction.insert(sessions).values({
      eventId: event.id,
      title: "Sesión principal",
      startsAt,
      endsAt,
    });'''
new = '''    await transaction.insert(sessions).values({
      eventId: event.id,
      title: "Sesión principal",
      startsAt,
      endsAt,
      // Un evento simulado reproduce contenido pregrabado; los demás parten de Zoom → IVS.
      streamingMode: event.format === "simulated" ? "simulated" : "zoom_to_ivs",
    });'''
if new not in s:
    if old not in s: print("FALLO: ancla de sesión principal"); sys.exit(1)
    s = s.replace(old, new, 1); open(p, "w", encoding="utf-8").write(s); print("ajustado", p)

p = "app/events/[slug]/event-detail.tsx"; s = open(p, encoding="utf-8").read()
old = '<p>Configura Zoom y prepara el canal de IVS.</p>'
new = '<p>{event.format === "simulated" ? "Elige el contenido pregrabado y prepara el canal de IVS." : event.format === "hybrid" ? "Configura Zoom, el contenido simulado y el canal de IVS." : "Configura Zoom y prepara el canal de IVS."}</p>'
if new not in s:
    if old not in s: print("FALLO: ancla de preparación"); sys.exit(1)
    s = s.replace(old, new, 1); open(p, "w", encoding="utf-8").write(s); print("ajustado", p)
print("LISTO")

# Texto del panel de video pregrabado: el archivo va a S3, no al disco local.
import re as _re
p = "app/events/[slug]/recorded-video-panel.tsx"
if os.path.exists(p):
    s = open(p, encoding="utf-8").read()
    t = _re.sub(r'MP4 de hasta 1 GB\. El archivo se guarda en este equipo \(~/\.icaza-live/media\), fuera de la carpeta sincronizada\.', 'MP4 de hasta 1 GB. El archivo se guarda en Amazon S3 (directorio event-videos/) y se sirve desde allí.', s)
    if t != s: open(p, "w", encoding="utf-8").write(t); print("ajustado", p)
