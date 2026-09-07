#!/usr/bin/env python3
"""Canal de IVS automático al confirmar el evento + consulta de los datos de
emisión (ingesta y clave) bajo demanda. Ediciones ancladas."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
hechos = []

def sub(text, pattern, repl, etiqueta):
    new, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", etiqueta); sys.exit(1)
    return new

# 1) Al confirmar el evento se aprovisiona el canal, igual que la reunión de Zoom.
p = root / "app/api/events/[slug]/route.ts"
s = p.read_text()
if "ensureIvsChannelForEvent" not in s:
    s = sub(s, r'(import \{\n  cancelZoomMeetingForEvent,\n  ensureZoomMeetingForEvent,\n  syncZoomMeetingForEvent,\n\} from "@/lib/zoom-automation";\n)',
            r'\1import { ensureIvsChannelForEvent } from "@/lib/ivs-automation";\n', "import de ivs-automation")
    s = sub(s, r'(    after\(\(\) => ensureZoomMeetingForEvent\(current\.id, zoomOptions\)\);\n)',
            r'\1    after(() => ensureIvsChannelForEvent(current.id, zoomOptions));\n', "llamada tras confirmar")
    p.write_text(s); hechos.append("aprovisionamiento automático")

# 2) Los datos de emisión se consultan a IVS cuando se necesitan.
p = root / "app/api/events/[slug]/streaming/route.ts"
s = p.read_text()
if "broadcast_details" not in s:
    m = re.search(r'import \{([^}]*)\} from "@/lib/aws-ivs";', s)
    if not m:
        print("ANCLA NO ENCONTRADA: import de aws-ivs"); sys.exit(1)
    nombres = [n.strip() for n in m.group(1).split(",") if n.strip()]
    if "getBroadcastDetails" not in nombres:
        nombres.append("getBroadcastDetails")
    s = sub(s, r'import \{[^}]*\} from "@/lib/aws-ivs";',
            lambda _m: 'import {\n  ' + ",\n  ".join(sorted(nombres)) + ',\n} from "@/lib/aws-ivs";', "import de aws-ivs")
    s = sub(s, r'(action\?:\s*"save"(?:\s*\|\s*"[a-z_]+")*)(;)',
            r'\1 | "broadcast_details"\2', "tipo de acción")
    s = sub(s, r'(body\.action !== "provision")(\))',
            r'\1 &&\n      body.action !== "broadcast_details"\2', "validación de acción")
    s = sub(s, r'(\n  if \(body\.action === "provision"\) \{)',
            r'''
  // Datos de emisión: se piden a IVS en el momento porque la clave no se
  // guarda en la base. Sirven para configurar Zoom o un codificador externo.
  if (body.action === "broadcast_details") {
    if (!record.session.ivsChannelArn) {
      return NextResponse.json(
        { error: "Este evento todavía no tiene canal de Amazon IVS." },
        { status: 409 },
      );
    }
    const credentials = readIvsCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: "Faltan las credenciales de AWS en el servidor." },
        { status: 409 },
      );
    }
    const details = await getBroadcastDetails(credentials, record.session.ivsChannelArn);
    if (!details.ok) {
      return NextResponse.json({ error: details.error }, { status: 502 });
    }
    await writeAuditLog({
      actor: auth.user,
      action: "streaming.broadcast_details.viewed",
      resourceType: "session",
      resourceId: record.session.id,
      summary: `Se consultaron los datos de emisión de “${record.event.title}”.`,
      request,
    });
    return NextResponse.json({
      data: {
        ingestEndpoint: details.ingestEndpoint,
        streamKey: details.streamKey,
        playbackUrl: details.playbackUrl,
      },
    });
  }
\1''', "bloque de datos de emisión")
    p.write_text(s); hechos.append("consulta de datos de emisión")

print("ok:", ", ".join(hechos) if hechos else "ya aplicado")
