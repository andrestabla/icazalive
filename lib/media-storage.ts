import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

// Los videos se guardan fuera del proyecto (y de OneDrive), junto a los datos
// locales de PGlite, para no sincronizar binarios grandes.
export function getMediaDirectory(): string {
  return process.env.ICAZA_MEDIA_DIR ?? join(homedir(), ".icaza-live", "media");
}

export function recordedVideoFilename(eventId: string): string {
  return `${eventId}.mp4`;
}

export function recordedVideoAbsolutePath(filename: string): string {
  return join(getMediaDirectory(), filename);
}

const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 GB

export class VideoValidationError extends Error {}

// Un MP4 válido comienza con un box "ftyp" en los bytes 4-8.
function looksLikeMp4(header: Uint8Array): boolean {
  return (
    header.length >= 8 &&
    header[4] === 0x66 &&
    header[5] === 0x74 &&
    header[6] === 0x79 &&
    header[7] === 0x70
  );
}

export async function saveRecordedVideo(
  eventId: string,
  body: ReadableStream<Uint8Array>,
): Promise<{ filename: string; size: number }> {
  await mkdir(getMediaDirectory(), { recursive: true });
  const filename = recordedVideoFilename(eventId);
  const absolutePath = recordedVideoAbsolutePath(filename);
  // Se escribe en un archivo temporal y solo se reemplaza el definitivo si la
  // carga completa es válida; así un intento fallido no destruye el video previo.
  const temporaryPath = `${absolutePath}.upload`;

  const reader = body.getReader();
  let total = 0;
  let headerChecked = false;
  let headerBuffer = new Uint8Array(0);

  const nodeStream = new Readable({
    read() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            this.push(null);
            return;
          }
          total += value.length;
          if (total > MAX_VIDEO_BYTES) {
            this.destroy(
              new VideoValidationError("El video supera el máximo de 1 GB."),
            );
            return;
          }
          if (!headerChecked) {
            const combined = new Uint8Array(headerBuffer.length + value.length);
            combined.set(headerBuffer);
            combined.set(value, headerBuffer.length);
            headerBuffer = combined;
            if (headerBuffer.length >= 12) {
              headerChecked = true;
              if (!looksLikeMp4(headerBuffer)) {
                this.destroy(
                  new VideoValidationError(
                    "El archivo no es un MP4 válido (se esperaba un contenedor ftyp).",
                  ),
                );
                return;
              }
            }
          }
          this.push(Buffer.from(value));
        })
        .catch((error: unknown) => {
          this.destroy(error instanceof Error ? error : new Error("stream"));
        });
    },
  });

  try {
    await pipeline(nodeStream, createWriteStream(temporaryPath));
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  if (!headerChecked) {
    await rm(temporaryPath, { force: true });
    throw new VideoValidationError("El archivo está vacío o incompleto.");
  }

  await rename(temporaryPath, absolutePath);
  const info = await stat(absolutePath);
  return { filename, size: info.size };
}

export async function deleteRecordedVideo(filename: string): Promise<void> {
  await rm(recordedVideoAbsolutePath(filename), { force: true });
}

export async function recordedVideoStats(filename: string) {
  try {
    return await stat(recordedVideoAbsolutePath(filename));
  } catch {
    return null;
  }
}
