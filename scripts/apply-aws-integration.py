#!/usr/bin/env python3
"""Aplica la integración de AWS (SES/IVS/S3) sobre el código de este entorno.

Cada edición comprueba que el fragmento original exista tal cual antes de
sustituirlo. Si un archivo divergió, se deja intacto y se reporta FALLO para
resolverlo a mano. Ejecutar dos veces es seguro: lo ya aplicado se omite.

Los archivos nuevos (lib/aws-signature.ts, lib/aws-ivs.ts, lib/aws-s3.ts,
app/room/[slug]/ivs-player.tsx) llegan por separado; este script solo edita
archivos existentes.
"""

import sys

EDITS = [
    (
        "lib/aws-ses.ts",
        [
            (
                '''  const region = process.env.AWS_SES_REGION || process.env.AWS_REGION;
  const accessKeyId =
    process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;''',
                '''  // Solo las variables específicas de SES activan el proveedor. Las genéricas
  // de AWS pertenecen al usuario IAM de IVS/S3, que no puede enviar correo:
  // heredarlas activaría SES con credenciales sin permiso ses:SendEmail.
  const region = process.env.AWS_SES_REGION;
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY;''',
            ),
        ],
    ),
    (
        "lib/integrations.ts",
        [
            (
                '''    sesRegion: process.env.AWS_SES_REGION || process.env.AWS_REGION || null,
    sesAccessKey: Boolean(
      process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    ),
    sesSecretKey: Boolean(
      process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    ),''',
                '''    // El checklist refleja la misma regla que readSesConfig(): solo cuentan
    // las variables específicas de SES, sin heredar las genéricas de AWS.
    sesRegion: process.env.AWS_SES_REGION || null,
    sesAccessKey: Boolean(process.env.AWS_SES_ACCESS_KEY_ID),
    sesSecretKey: Boolean(process.env.AWS_SES_SECRET_ACCESS_KEY),''',
            ),
        ],
    ),
    (
        "lib/streaming.ts",
        [
            (
                '''  id: "schedule" | "source" | "distribution" | "credentials";''',
                '''  id: "schedule" | "source" | "distribution" | "credentials" | "signal";''',
            ),
        ],
    ),
    (
        "lib/media-storage.ts",
        [
            (
                '''import { createWriteStream } from "node:fs";''',
                '''import { createReadStream, createWriteStream } from "node:fs";''',
            ),
            (
                '''import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";''',
                '''import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { deleteVideo, putVideo, readS3Config, videoPlaybackUrl } from "@/lib/aws-s3";''',
            ),
            (
                '''  await rename(temporaryPath, absolutePath);
  const info = await stat(absolutePath);
  return { filename, size: info.size };
}''',
                '''  await rename(temporaryPath, absolutePath);
  const info = await stat(absolutePath);

  // Con S3 configurado, el video se replica al bucket: en un despliegue el
  // disco local es efímero y la copia de S3 es la que sobrevive. Se sube
  // desde el archivo ya validado, con tamaño conocido.
  const s3 = readS3Config();
  if (s3) {
    const upload = await putVideo(
      s3,
      remoteVideoKey(filename),
      Readable.toWeb(createReadStream(absolutePath)) as ReadableStream<Uint8Array>,
      info.size,
    );
    if (!upload.ok) {
      await rm(absolutePath, { force: true });
      throw new VideoValidationError(
        `El video se validó pero no pudo copiarse a S3: ${upload.error}`,
      );
    }
  }

  return { filename, size: info.size };
}

function remoteVideoKey(filename: string): string {
  return `event-videos/${filename}`;
}

// URL temporal firmada para reproducir el video directamente desde S3, o null
// si S3 no está configurado. El navegador descarga del bucket sin pasar por
// este servidor.
export function recordedVideoRemoteUrl(filename: string): string | null {
  const s3 = readS3Config();
  if (!s3) return null;
  return videoPlaybackUrl(s3, remoteVideoKey(filename));
}''',
            ),
            (
                '''export async function deleteRecordedVideo(filename: string): Promise<void> {
  await rm(recordedVideoAbsolutePath(filename), { force: true });
}''',
                '''export async function deleteRecordedVideo(filename: string): Promise<void> {
  await rm(recordedVideoAbsolutePath(filename), { force: true });
  const s3 = readS3Config();
  if (s3) {
    // Si el borrado remoto falla se ignora: el objeto quedará huérfano en el
    // bucket, pero la referencia en la base ya no existe y no es accesible.
    await deleteVideo(s3, remoteVideoKey(filename));
  }
}''',
            ),
        ],
    ),
    (
        "app/api/public/events/[slug]/video/route.ts",
        [
            (
                '''import {
  recordedVideoAbsolutePath,
  recordedVideoStats,
} from "@/lib/media-storage";''',
                '''import {
  recordedVideoAbsolutePath,
  recordedVideoRemoteUrl,
  recordedVideoStats,
} from "@/lib/media-storage";''',
            ),
            (
                '''  const stats = await recordedVideoStats(event.recordedVideoPath);
  if (!stats) {
    return NextResponse.json(
      { error: "El archivo de video no está disponible en este equipo." },
      { status: 404 },
    );
  }''',
                '''  const stats = await recordedVideoStats(event.recordedVideoPath);
  if (!stats) {
    // El disco local no tiene el archivo (en un despliegue es efímero). Si S3
    // está configurado, el navegador reproduce directamente desde el bucket
    // con una URL firmada temporal; S3 atiende las peticiones de rango.
    const remoteUrl = recordedVideoRemoteUrl(event.recordedVideoPath);
    if (remoteUrl) {
      return NextResponse.redirect(remoteUrl, 302);
    }
    return NextResponse.json(
      { error: "El archivo de video no está disponible en este equipo." },
      { status: 404 },
    );
  }''',
            ),
        ],
    ),
    (
        "app/api/integrations/route.ts",
        [
            (
                '''import { readSesConfig, verifySesAccess } from "@/lib/aws-ses";''',
                '''import { readSesConfig, verifySesAccess } from "@/lib/aws-ses";
import { readIvsCredentials, verifyIvsAccess } from "@/lib/aws-ivs";''',
            ),
            (
                '''  if (body.provider === "email" && body.action === "check") {''',
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

  if (body.provider === "email" && body.action === "check") {''',
            ),
            (
                '''  // "error" se reserva para credenciales presentes que SES rechaza.
  const status =
    body.provider === "email" && providerCheck && !providerCheck.credentialsMissing
      ? providerCheck.ok
        ? ("connected" as const)
        : ("error" as const)
      : existing?.status === "connected" && body.provider !== "email"
        ? ("connected" as const)
        : evaluation.ready''',
                '''  // "error" se reserva para credenciales presentes que el proveedor rechaza.
  const checkedProvider = body.provider === "email" || body.provider === "amazon_ivs";
  const status =
    checkedProvider && providerCheck && !providerCheck.credentialsMissing
      ? providerCheck.ok
        ? ("connected" as const)
        : ("error" as const)
      : existing?.status === "connected" && !checkedProvider
        ? ("connected" as const)
        : evaluation.ready''',
            ),
        ],
    ),
    (
        "app/api/events/[slug]/streaming/route.ts",
        [
            (
                '''import {
  evaluateStreamingConfiguration,
  getCredentialAvailability,
  hasBlockingStreamingChecks,
  type StreamingMode,
} from "@/lib/streaming";''',
                '''import {
  evaluateStreamingConfiguration,
  getCredentialAvailability,
  hasBlockingStreamingChecks,
  type StreamingCheck,
  type StreamingMode,
} from "@/lib/streaming";
import {
  createEventChannel,
  getStreamState,
  readIvsCredentials,
} from "@/lib/aws-ivs";''',
            ),
            (
                '''    action?: "save" | "run_check";''',
                '''    action?: "save" | "run_check" | "provision";''',
            ),
            (
                '''    (body.action !== undefined &&
      body.action !== "save" &&
      body.action !== "run_check") ||''',
                '''    (body.action !== undefined &&
      body.action !== "save" &&
      body.action !== "run_check" &&
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
                '''  await writeAuditLog({
    actor: auth.user,
    action:
      body.action === "run_check"
        ? "streaming.technical_check"
        : "streaming.updated",
    resourceType: "session",
    resourceId: updated.id,
    summary:
      body.action === "run_check"
        ? `Revisión técnica ejecutada para “${record.event.title}”.`
        : `Transmisión de “${record.event.title}” actualizada.`,''',
                '''  await writeAuditLog({
    actor: auth.user,
    action:
      body.action === "run_check"
        ? "streaming.technical_check"
        : body.action === "provision"
          ? "streaming.channel_provisioned"
          : "streaming.updated",
    resourceType: "session",
    resourceId: updated.id,
    summary:
      body.action === "run_check"
        ? `Revisión técnica ejecutada para “${record.event.title}”.`
        : body.action === "provision"
          ? `Canal de Amazon IVS creado para “${record.event.title}”.`
          : `Transmisión de “${record.event.title}” actualizada.`,''',
            ),
            (
                '''  return NextResponse.json({
    data: {
      session: updated,
      checks,
      credentials: getCredentialAvailability(),
    },
  });
}''',
                '''  return NextResponse.json({
    data: {
      session: updated,
      checks,
      credentials: getCredentialAvailability(),
      // Solo tras aprovisionar: el stream key no se guarda y no volverá a
      // mostrarse. Quien opera el evento lo copia a Zoom en ese momento.
      provisioned,
    },
  });
}''',
            ),
        ],
    ),
    (
        "app/room/[slug]/room-client.tsx",
        [
            (
                '''import SimulatedPlayer''',
                '''import IvsPlayer from "./ivs-player";
import SimulatedPlayer''',
            ),
            (
                '''            ) : isLive && room.session.playbackUrl ? (
              <div className="room-video-ready">
                <span>▶</span>
                <h2>La señal está disponible</h2>
                <p>El reproductor utilizará la URL configurada en Amazon IVS.</p>
                <a href={room.session.playbackUrl} target="_blank" rel="noreferrer">Abrir señal de reproducción ↗</a>
              </div>
            ) : isLive && room.session.zoomJoinUrl ? (''',
                '''            ) : isLive && room.session.playbackUrl ? (
              <IvsPlayer playbackUrl={room.session.playbackUrl} />
            ) : isLive && room.session.zoomJoinUrl ? (''',
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
        for old, new in replacements:
            if new in updated:
                skipped += 1
                continue
            if old not in updated:
                print(f"FALLO  {path}: un fragmento esperado no coincide; archivo sin tocar.")
                failures += 1
                updated = content
                applied = 0
                break
            updated = updated.replace(old, new, 1)
            applied += 1
        else:
            if applied:
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write(updated)
                print(f"OK     {path}: {applied} cambio(s) aplicado(s), {skipped} ya presente(s).")
            else:
                print(f"OK     {path}: sin cambios pendientes.")

    if failures:
        print(f"\n{failures} archivo(s) requieren revisión manual. El resto quedó aplicado.")
        return 1
    print("\nIntegración aplicada por completo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
