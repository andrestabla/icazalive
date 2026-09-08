#!/usr/bin/env python3
"""Guarda cifrada la clave de emisión del canal de IVS y la usa cuando AWS no
permite leerla. Ediciones ancladas (db/schema.ts diverge en Replit)."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
hechos = []

# 1) Columna en el esquema
p = root / "db/schema.ts"
s = p.read_text()
if "ivsStreamKeyEncrypted" not in s:
    nuevo, n = re.subn(r'(    ivsChannelArn: text\("ivs_channel_arn"\),\n)',
        r'''\1    // Clave de emisión cifrada con SECRET_BOX_KEY. Se guarda para poder
    // mostrarla al organizador sin volver a pedírsela a AWS.
    ivsStreamKeyEncrypted: text("ivs_stream_key_encrypted"),\n''', s, count=1)
    if n != 1:
        print("ANCLA NO ENCONTRADA: columna ivs_channel_arn"); sys.exit(1)
    p.write_text(nuevo); hechos.append("esquema")

# 2) La ruta de transmisión usa la copia cifrada como respaldo
p = root / "app/api/events/[slug]/streaming/route.ts"
s = p.read_text()
if "openSecret" not in s:
    def sub(pattern, repl, etiqueta):
        global s
        nuevo, n = re.subn(pattern, repl, s, count=1, flags=re.S)
        if n != 1:
            print("ANCLA NO ENCONTRADA:", etiqueta); sys.exit(1)
        s = nuevo

    m = re.search(r'import \{([^}]*)\} from "@/lib/aws-ivs";', s)
    if not m:
        print("ANCLA NO ENCONTRADA: import de aws-ivs"); sys.exit(1)
    nombres = [n.strip() for n in m.group(1).split(",") if n.strip()]
    for extra in ("getChannelInfo", "getBroadcastDetails"):
        if extra not in nombres:
            nombres.append(extra)
    s = s[:m.start()] + 'import {\n  ' + ",\n  ".join(sorted(nombres)) + ',\n} from "@/lib/aws-ivs";' + s[m.end():]

    sub(r'(import \{ writeAuditLog \} from "@/lib/audit";\n)',
        r'\1import { openSecret, sealSecret } from "@/lib/secret-box";\n', "import de audit")

    sub(r'(    const details = await getBroadcastDetails\(credentials, record\.session\.ivsChannelArn\);\n)'
        r'(    if \(!details\.ok\) \{\n      return NextResponse\.json\(\{ error: details\.error \}, \{ status: 502 \}\);\n    \}\n)',
        r'''\1    // Si la cuenta de AWS no permite leer la clave, se recurre a la copia
    // cifrada que se guardó al crear el canal.
    const guardada = openSecret(record.session.ivsStreamKeyEncrypted);
    if (!details.ok && !guardada) {
      return NextResponse.json({ error: details.error }, { status: 502 });
    }
    let ingestEndpoint = details.ok ? details.ingestEndpoint : "";
    let playbackUrl = details.ok ? details.playbackUrl : record.session.playbackUrl ?? "";
    if (!details.ok) {
      const info = await getChannelInfo(credentials, record.session.ivsChannelArn);
      if (!info.ok) {
        return NextResponse.json({ error: info.error }, { status: 502 });
      }
      ingestEndpoint = info.ingestEndpoint;
      playbackUrl = info.playbackUrl || playbackUrl;
    }
    const streamKey = details.ok ? details.streamKey : guardada!;
''', "respaldo de la clave")

    sub(r'        ingestEndpoint: details\.ingestEndpoint,\n        streamKey: details\.streamKey,\n        playbackUrl: details\.playbackUrl,\n',
        '        ingestEndpoint,\n        streamKey,\n        playbackUrl,\n', "respuesta de datos")

    sub(r'(  let provisioned: \{\n    ingestEndpoint: string;\n    streamKey: string;\n  \} \| null = null;\n)',
        r'\1  let sealedStreamKey: string | null = null;\n', "declaración de provisioned")

    sub(r'(    provisioned = \{\n      ingestEndpoint: creation\.channel\.ingestEndpoint,\n      streamKey: creation\.channel\.streamKey,\n    \};\n)',
        r'\1    sealedStreamKey = sealSecret(creation.channel.streamKey);\n', "asignación de provisioned")

    sub(r'(      ivsChannelArn: merged\.ivsChannelArn,\n      playbackUrl: merged\.playbackUrl,\n)',
        r'\1      ...(sealedStreamKey ? { ivsStreamKeyEncrypted: sealedStreamKey } : {}),\n', "persistencia de la sesión")

    p.write_text(s); hechos.append("ruta de transmisión")

# 3) El aprovisionamiento automático también la guarda
p = root / "lib/ivs-automation.ts"
s = p.read_text()
if "sealSecret" not in s:
    s = s.replace('import { createEventChannel, readIvsCredentials } from "@/lib/aws-ivs";',
                  'import { createEventChannel, readIvsCredentials } from "@/lib/aws-ivs";\nimport { sealSecret } from "@/lib/secret-box";')
    s = s.replace('''      playbackUrl: creation.channel.playbackUrl,''','''      playbackUrl: creation.channel.playbackUrl,
      // La clave solo se entrega al crear el canal: se guarda cifrada para
      // poder mostrarla después sin volver a pedírsela a AWS.
      ivsStreamKeyEncrypted: sealSecret(creation.channel.streamKey),''')
    p.write_text(s); hechos.append("aprovisionamiento automático")

print("ok:", ", ".join(hechos) if hechos else "ya aplicado")
