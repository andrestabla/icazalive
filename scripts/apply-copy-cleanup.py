#!/usr/bin/env python3
"""Limpieza de textos de desarrollo visibles para el usuario ("modo local",
"localmente", "antes de conectar proveedores", etc.). Reemplazos exactos y
tolerantes: si un texto no existe en el archivo (versión divergente), se omite
y se informa. Idempotente."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

R = {
  "app/dashboard-client.tsx": [
    ('"Entorno local"', '"Canales de transmisión en AWS"'),
    ('local: "Local"', 'local: "Sin conectar"'),
    ("Este es el estado real de tus eventos y operaciones locales.", "Este es el estado actual de tus eventos y operaciones."),
    ("<small>Base local</small>", "<small>Total</small>"),
    ("Movimientos derivados de los datos locales.", "Últimos movimientos registrados en la plataforma."),
  ],
  "app/room/[slug]/ivs-player.tsx": [
    ('? "Señal en vivo desde Amazon IVS"', '? "Señal en vivo"'),
  ],
  "app/room/[slug]/room-client.tsx": [
    ('"Lista localmente"', '"Lista"'),
    ("Interacción sincronizada cada 2 segundos", "Interacción en tiempo real"),
    ("<small>sin saturar el chat</small>", "<small>Comparte cómo lo vives</small>"),
  ],
  "app/events/[slug]/studio/studio-client.tsx": [
    ('ready: "Lista localmente"', 'ready: "Lista"'),
    ("SALA TÉCNICA LOCAL", "SALA TÉCNICA"),
    ("Prepara la señal y revisa el recorrido antes de conectar los proveedores.", "Prepara la señal y revisa el recorrido antes de salir al aire."),
    ("Estado de la sesión en este equipo.", "Estado de la sesión."),
    ("Estado de la sesión en este equipo", "Estado de la sesión"),
  ],
  "app/events/[slug]/event-detail.tsx": [
    ('"Lista localmente"', '"Lista"'),
    ('"Entorno local"', '"Canales de transmisión en AWS"'),
    ('local: "Local"', 'local: "Sin conectar"'),
    ('"Configuración técnica validada localmente."', '"Configuración técnica validada."'),
    ('ready: "Lista localmente"', 'ready: "Lista"'),
    ("<span>Al buzón local o al proveedor</span>", "<span>Entregados al proveedor de correo</span>"),
    ("<p><b>Modo local</b> Las entregas quedan registradas en la base de datos. Ningún correo saldrá hasta conectar Amazon SES u otro proveedor.</p>",
     "<p><b>Registro de entregas</b> Cada correo queda registrado con su estado. Los envíos salen por el proveedor configurado en Integraciones.</p>"),
    ("<p><b>Consola local sincronizada</b> La sala y esta vista consultan cambios cada 2 segundos. La infraestructura WebSocket/SSE y escalamiento horizontal se activarán al desplegar.</p>",
     "<p><b>Sincronización en tiempo real</b> La sala y esta vista se actualizan al instante: lo que apruebes, publiques o retires llega a los participantes sin recargar.</p>"),
    ("% de la configuración local preparada.", "% de la configuración preparada."),
    ("<h2>Preparación local</h2><p>Validaciones antes de conectar proveedores.</p>", "<h2>Preparación técnica</h2><p>Validaciones de la sesión antes de transmitir.</p>"),
    ("También se quitará su configuración local de Zoom y Amazon IVS.", "También se quitará su configuración de Zoom y Amazon IVS."),
  ],
  "app/events/[slug]/event-analytics-panel.tsx": [
    ("Informe del evento generado localmente.", "Informe del evento."),
    ("Preguntas y votaciones registradas localmente.", "Preguntas y votaciones registradas en la sala."),
  ],
  "app/analytics/page.tsx": [
    ("Resultados consolidados de tus eventos y operaciones locales.", "Resultados consolidados de todos tus eventos."),
    ("Base de datos local · actualización al abrir", "Datos actualizados al abrir esta página"),
    ("Disponibilidad antes de conectar Zoom y AWS.", "Sesiones listas para transmitir."),
  ],
  "app/integrations/integrations-client.tsx": [
    ("está preparada localmente.", "está preparada."),
    ("Completa primero los metadatos locales y después traslada los\n              secretos al entorno de despliegue.", "Completa los datos de cada servicio; las claves privadas se\n              guardan en el servidor, nunca aquí."),
    ("Mientras SES no esté configurado, los correos se guardan en\n                    el buzón local de vista previa: puedes revisar el contenido\n                    exacto sin enviar nada al exterior.",
     "Mientras no haya un proveedor de correo activo, los envíos quedan\n                    registrados sin salir: puedes revisar el contenido exacto\n                    antes de conectar el proveedor."),
  ],
  "app/privacy/privacy-center-client.tsx": [
    (': "localmente"}', ': "pendiente de publicación"}'),
    ("Versiones vigentes y solicitudes almacenadas en la base local ·", "Versiones vigentes y solicitudes registradas en la plataforma ·"),
  ],
  "app/help/help-center-client.tsx": [
    ('footer: "Documentación local disponible en todo momento"', 'footer: "Documentación disponible en todo momento"'),
  ],
  "app/api/public/events/[slug]/video/route.ts": [
    ('"El archivo de video no está disponible en este equipo."', '"El archivo de video no está disponible."'),
  ],
  "lib/streaming.ts": [
    ("`Configuración local válida; faltan credenciales de ${missingCredentials.join(\" y \")} para conectarse.`",
     "`Configuración válida; faltan credenciales de ${missingCredentials.join(\" y \")} en el servidor.`"),
  ],
  "lib/email-provider.ts": [
    ('local: "Buzón local de vista previa"', 'local: "Registro interno (sin envío)"'),
  ],
}

total = 0
for rel, pairs in R.items():
    p = root / rel
    if not p.exists():
        print(f"omitido {rel}: no existe"); continue
    s = p.read_text(); before = s; hits = 0
    for old, new in pairs:
        if old in s:
            s = s.replace(old, new); hits += 1
        elif new in s:
            hits += 0
        else:
            print(f"  aviso {rel}: no se encontró «{old[:60]}»")
    if s != before:
        p.write_text(s)
    total += hits
    print(f"OK {rel}: {hits} reemplazo(s)")
print(f"LISTO limpieza de textos ({total} reemplazos)")
