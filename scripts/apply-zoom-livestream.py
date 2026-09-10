#!/usr/bin/env python3
"""Zoom → IVS gestionado desde la plataforma. Ediciones ancladas en archivos
divergentes de Replit: lib/zoom.ts (acceso genérico a la API) y
app/events/[slug]/event-detail.tsx (montaje del panel)."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def sub(text, pattern, repl, etiqueta):
    new, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", etiqueta); sys.exit(1)
    return new

# 1) lib/zoom.ts: exportar zoomApiRequest(path, init) reutilizando la función
#    privada que ya hace las llamadas autenticadas (nombre variable por entorno).
p = root / "lib/zoom.ts"
s = p.read_text()
if "export async function zoomApiRequest" not in s:
    m = re.search(r'async function (\w+)(?:<[^>]*>)?\(\s*(?:path|endpoint|url)\s*:\s*string\s*,\s*(\w+)\s*(\?)?\s*:\s*RequestInit', s)
    if not m:
        print("ANCLA NO ENCONTRADA: función de petición a Zoom en lib/zoom.ts (revisa las firmas impresas arriba)")
        sys.exit(1)
    inner = m.group(1)
    s = s.rstrip("\n") + f'''

// Acceso genérico a la API v2 de Zoom para módulos que necesitan endpoints no
// cubiertos arriba (por ejemplo, la transmisión personalizada de una reunión).
export async function zoomApiRequest(path: string, init: RequestInit = {{}}): Promise<Response> {{
  return {inner}(path, init);
}}
'''
    p.write_text(s)
    print(f"OK lib/zoom.ts: zoomApiRequest → {inner}")
else:
    print("OK lib/zoom.ts: zoomApiRequest ya existe")

# 2) event-detail.tsx: importar y montar el panel bajo el bloque de datos de emisión.
p = root / "app/events/[slug]/event-detail.tsx"
s = p.read_text()
if "ZoomLivestreamPanel" not in s:
    s = sub(s, r'(import "\.\./broadcast-details\.css";\n)',
            lambda m: m.group(1) + 'import ZoomLivestreamPanel from "./zoom-livestream-panel";\n', "import del panel")
    s = sub(s, r'(\n(\s*)</section>\s*\n\s*<div className="streaming-pipeline")',
            lambda m: f'\n{m.group(2)}  {{streamingSession.streamingMode === "zoom_to_ivs" && (\n{m.group(2)}    <ZoomLivestreamPanel slug={{event.slug}} />\n{m.group(2)}  )}}' + m.group(1),
            "cierre de la sección de estado técnico")
    p.write_text(s)
    print("OK event-detail.tsx: panel montado")
else:
    print("OK event-detail.tsx: panel ya montado")
print("LISTO zoom-livestream")
