#!/usr/bin/env python3
"""(1) Widget de ayuda en móvil dentro de la sala: abajo a la derecha, encima
del cuadro de mensaje, con panel visible y desplazable. (2) La casilla
"Grabar la sesión" decide si el canal de IVS se crea con grabación."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
def patch(rel, pairs, marker):
    p = root / rel; s = p.read_text(encoding="utf-8")
    if marker in s: print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if old not in s: print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8"); print(f"OK {rel}: aplicado")

patch("app/room/[slug]/room-mobile.css", [
    ("""  /* El widget de ayuda no debe tapar el botón de enviar del chat. */
  body:has(.participant-room) .global-help-widget { right: 8px; bottom: auto; top: 8px; }
  body:has(.participant-room) .global-help-trigger { width: 34px; height: 34px; opacity: .85; }""",
     """  /* Widget de ayuda: abajo a la derecha, por encima del cuadro de mensaje,
     y con el panel visible dentro de la pantalla. */
  body:has(.participant-room) .global-help-widget { right: 10px; bottom: 74px; top: auto; z-index: 60; }
  body:has(.participant-room) .global-help-trigger { width: 42px; height: 42px; opacity: .95; }
  body:has(.participant-room) .global-help-popover { bottom: 52px; max-height: calc(100vh - 150px); max-height: calc(100dvh - 150px); overflow-y: auto; }"""),
], "bottom: 74px; top: auto;")

# La grabación solo se activa en el canal si la sesión tiene "Grabar la sesión".
patch("lib/ivs-automation.ts", [
    ("    recordingConfigurationArn: process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined,",
     "    // Solo graba si la sesión tiene marcado \"Grabar la sesión\".\n    recordingConfigurationArn: session.recordingEnabled ? process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined : undefined,"),
], "session.recordingEnabled ?")
patch("app/api/events/[slug]/streaming/route.ts", [
    ("""      recordingConfigurationArn:
        process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined,""",
     """      // Solo graba si la sesión tiene marcado "Grabar la sesión".
      recordingConfigurationArn:
        (body.recordingEnabled ?? record.session.recordingEnabled)
          ? process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined
          : undefined,"""),
], "(body.recordingEnabled ?? record.session.recordingEnabled)")
patch("lib/simulated-emitter.ts", [
    ("    recordingConfigurationArn: process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined,",
     "    // Solo graba si la sesión tiene marcado \"Grabar la sesión\".\n    recordingConfigurationArn: session.recordingEnabled ? process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined : undefined,"),
], "session.recordingEnabled ?")
print("LISTO ayuda móvil + grabación")
