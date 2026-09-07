#!/usr/bin/env python3
"""Botón "Datos de emisión" en la pantalla de transmisión del evento: muestra
la dirección de ingesta y la clave para configurar Zoom o un codificador."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/events/[slug]/event-detail.tsx"
s = p.read_text()
if "broadcastDetails" in s:
    print("ya aplicado"); sys.exit(0)

def sub(pattern, repl, etiqueta):
    global s
    new, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", etiqueta); sys.exit(1)
    s = new

# Hoja de estilos propia
sub(r'(^"use client";\n)', lambda _m: '"use client";\n\nimport "../broadcast-details.css";\n', "import de estilos")

# Estado y consulta
sub(r'(  const \[streamingSaving, setStreamingSaving\] = useState\(false\);\n)',
    lambda _m: '''  const [streamingSaving, setStreamingSaving] = useState(false);
  const [broadcastDetails, setBroadcastDetails] = useState<{
    ingestEndpoint: string;
    streamKey: string;
  } | null>(null);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastRevealed, setBroadcastRevealed] = useState(false);
''', "estado del panel")

sub(r'(  const saveStreamingConfiguration = async \()',
    lambda _m: '''  // La clave de emisión no se guarda en la base: se pide a Amazon IVS en el
  // momento en que el organizador la necesita para configurar la fuente.
  const loadBroadcastDetails = async () => {
    if (!streamingSession) return;
    setBroadcastLoading(true);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/streaming`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: streamingSession.id,
        action: "broadcast_details",
      }),
    });
    const payload = (await response.json()) as {
      data?: { ingestEndpoint: string; streamKey: string };
      error?: string;
    };
    if (response.ok && payload.data) {
      setBroadcastDetails(payload.data);
      setBroadcastRevealed(false);
    } else {
      setMessage(payload.error ?? "No fue posible obtener los datos de emisión.");
    }
    setBroadcastLoading(false);
  };

  const saveStreamingConfiguration = async (''', "función de consulta")

# Botón junto a los demás
sub(r'(                <Link className="primary-button link-button" href=\{`/events/\$\{event\.slug\}/studio`\}>\n                  Abrir sala técnica\n                </Link>\n)',
    lambda _m: '''                <button
                  className="secondary-action"
                  disabled={broadcastLoading}
                  onClick={() => void loadBroadcastDetails()}
                >
                  {broadcastLoading ? "Consultando…" : "Datos de emisión"}
                </button>
                <Link className="primary-button link-button" href={`/events/${event.slug}/studio`}>
                  Abrir sala técnica
                </Link>
''', "botón de datos de emisión")

# Panel con los datos
sub(r'(              </div>\n            </section>\n)',
    lambda _m: '''              </div>
              {broadcastDetails && (
                <div className="broadcast-details">
                  <p className="eyebrow">DATOS DE EMISIÓN</p>
                  <p>
                    Configura estos valores en tu fuente de video. En Zoom:
                    Más → En vivo en un servicio de streaming personalizado.
                  </p>
                  <label>
                    URL del servidor
                    <input readOnly value={broadcastDetails.ingestEndpoint} onFocus={(input) => input.target.select()} />
                  </label>
                  <label>
                    Clave de emisión
                    <input
                      readOnly
                      type={broadcastRevealed ? "text" : "password"}
                      value={broadcastDetails.streamKey}
                      onFocus={(input) => input.target.select()}
                    />
                  </label>
                  <div className="broadcast-details-actions">
                    <button className="secondary-action" onClick={() => setBroadcastRevealed((value) => !value)}>
                      {broadcastRevealed ? "Ocultar clave" : "Mostrar clave"}
                    </button>
                    <button className="secondary-action" onClick={() => setBroadcastDetails(null)}>
                      Cerrar
                    </button>
                  </div>
                  <small>
                    Trata la clave como una contraseña: quien la tenga puede emitir en este evento.
                  </small>
                </div>
              )}
            </section>
''', "panel de datos")

p.write_text(s)
print("ok", p)
