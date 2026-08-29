#!/usr/bin/env python3
"""Segunda pasada del aplicador: mismas garantías, anclas adaptadas a los dos
archivos que el agente de Replit reescribió (Zoom administrado y sync_zoom).
Cada edición exige coincidencia exacta; si no coincide, el archivo no se toca.
"""

import sys

EDITS = [
    (
        "app/api/integrations/route.ts",
        [
            (
                '''import { readSesConfig, verifySesAccess } from "@/lib/aws-ses";''',
                '''import { readSesConfig, verifySesAccess } from "@/lib/aws-ses";
import { readIvsCredentials, verifyIvsAccess } from "@/lib/aws-ivs";''',
            ),
            (
                '''  // Para el correo, "revisar" hace una consulta real a SES con las''',
                '''  // Para Amazon IVS, "revisar" comprueba que las credenciales del servidor
  // pueden listar canales, sin crear recursos.
  if (body.provider === "amazon_ivs" && body.action === "check") {
    const ivsCredentials = readIvsCredentials();
    if (!ivsCredentials) {
      providerCheck = {
        ok: false,
        credentialsMissing: true,
        detail:
          "Faltan variables de entorno de AWS. Define AWS_REGION, AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY para verificar la conexión.",
      };
    } else {
      providerCheck = await verifyIvsAccess({
        ...ivsCredentials,
        region: region ?? ivsCredentials.region,
      });
    }
  }

  // Para el correo, "revisar" hace una consulta real a SES con las''',
            ),
            (
                '''    (body.provider === "email" || body.provider === "zoom") &&''',
                '''    (body.provider === "email" ||
      body.provider === "zoom" ||
      body.provider === "amazon_ivs") &&''',
            ),
        ],
    ),
    (
        "app/api/events/[slug]/streaming/route.ts",
        [
            (
                '''  type StreamingMode,
} from "@/lib/streaming";''',
                '''  type StreamingCheck,
  type StreamingMode,
} from "@/lib/streaming";
import {
  createEventChannel,
  getStreamState,
  readIvsCredentials,
} from "@/lib/aws-ivs";''',
            ),
            (
                '''    action?: "save" | "run_check" | "sync_zoom";''',
                '''    action?: "save" | "run_check" | "sync_zoom" | "provision";''',
            ),
            (
                '''      body.action !== "sync_zoom") ||''',
                '''      body.action !== "sync_zoom" &&
      body.action !== "provision") ||''',
            ),
            (
                '''  const mode = body.streamingMode ?? record.session.streamingMode;
  const merged = {''',
                '''  const mode = body.streamingMode ?? record.session.streamingMode;

  // Aprovisionamiento: crea el canal de IVS para este evento y guarda su ARN
  // y URL de reproducción. El stream key y el ingest se devuelven una sola
  // vez en la respuesta y no se persisten en la base.
  let provisioned: {
    ingestEndpoint: string;
    streamKey: string;
  } | null = null;
  if (body.action === "provision") {
    if (mode !== "zoom_to_ivs" && mode !== "ivs_direct") {
      return NextResponse.json(
        { error: "Este modo de transmisión no utiliza Amazon IVS." },
        { status: 400 },
      );
    }
    const ivsCredentials = readIvsCredentials();
    if (!ivsCredentials) {
      return NextResponse.json(
        {
          error:
            "Faltan AWS_REGION, AWS_ACCESS_KEY_ID o AWS_SECRET_ACCESS_KEY en el servidor.",
        },
        { status: 409 },
      );
    }
    const creation = await createEventChannel(ivsCredentials, {
      name: `icaza-${record.event.slug}`,
      recordingConfigurationArn:
        process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined,
    });
    if (!creation.ok) {
      return NextResponse.json(
        { error: `No fue posible crear el canal. ${creation.error}` },
        { status: 502 },
      );
    }
    ivsChannelArn = creation.channel.channelArn;
    playbackUrl = creation.channel.playbackUrl;
    provisioned = {
      ingestEndpoint: creation.channel.ingestEndpoint,
      streamKey: creation.channel.streamKey,
    };
  }

  const merged = {''',
            ),
            (
                '''  const checks = evaluateStreamingConfiguration(merged);
  const hasBlockingChecks = hasBlockingStreamingChecks(checks);''',
                '''  const checks: StreamingCheck[] = evaluateStreamingConfiguration(merged);

  // La revisión técnica también consulta si la señal está entrando al canal.
  // Es informativa: un canal sin señal días antes del evento es lo esperado,
  // así que nunca bloquea.
  if (
    body.action === "run_check" &&
    (merged.mode === "zoom_to_ivs" || merged.mode === "ivs_direct") &&
    merged.ivsChannelArn
  ) {
    const ivsCredentials = readIvsCredentials();
    if (ivsCredentials) {
      const signal = await getStreamState(ivsCredentials, merged.ivsChannelArn);
      checks.push({
        id: "signal",
        label: "Señal en el canal",
        status: signal.state === "unavailable" ? "warning" : "pass",
        detail:
          signal.state === "live"
            ? `El canal está recibiendo señal (salud ${signal.health}, ${signal.viewerCount} espectadores).`
            : signal.state === "offline"
              ? "El canal existe pero aún no recibe señal. Inicia la transmisión desde Zoom para verla aquí."
              : `No fue posible consultar el canal: ${signal.detail}`,
      });
    }
  }

  const hasBlockingChecks = hasBlockingStreamingChecks(checks);''',
            ),
            (
                '''    action:
      body.action === "run_check"
        ? "streaming.technical_check"
        : "streaming.updated",''',
                '''    action:
      body.action === "run_check"
        ? "streaming.technical_check"
        : body.action === "provision"
          ? "streaming.channel_provisioned"
          : "streaming.updated",''',
            ),
            (
                '''    summary:
      body.action === "run_check"
        ? `Revisión técnica ejecutada para “${record.event.title}”.`
        : `Transmisión de “${record.event.title}” actualizada.`,''',
                '''    summary:
      body.action === "run_check"
        ? `Revisión técnica ejecutada para “${record.event.title}”.`
        : body.action === "provision"
          ? `Canal de Amazon IVS creado para “${record.event.title}”.`
          : `Transmisión de “${record.event.title}” actualizada.`,''',
            ),
            (
                '''      zoomSyncStatus: getZoomSyncStatus(updated),
    },
  });
}''',
                '''      zoomSyncStatus: getZoomSyncStatus(updated),
      // Solo tras aprovisionar: el stream key no se guarda y no volverá a
      // mostrarse. Quien opera el evento lo copia a Zoom en ese momento.
      provisioned,
    },
  });
}''',
            ),
        ],
    ),
]


def main() -> int:
    failures = 0
    for path, replacements in EDITS:
        try:
            with open(path, encoding="utf-8") as handle:
                content = handle.read()
        except FileNotFoundError:
            print(f"FALLO  {path}: el archivo no existe en este entorno.")
            failures += 1
            continue

        updated = content
        applied = 0
        skipped = 0
        broken = None
        for index, (old, new) in enumerate(replacements, start=1):
            if new in updated:
                skipped += 1
                continue
            if old not in updated:
                broken = index
                break
            updated = updated.replace(old, new, 1)
            applied += 1

        if broken is not None:
            print(f"FALLO  {path}: la edición {broken} no coincide; archivo sin tocar.")
            failures += 1
            continue

        if applied:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(updated)
        print(f"OK     {path}: {applied} aplicada(s), {skipped} ya presente(s).")

    if failures:
        print(f"\n{failures} archivo(s) requieren revisión manual.")
        return 1
    print("\nSegunda pasada completa.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
