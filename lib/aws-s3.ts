import {
  presignUrl,
  signRequest,
  type AwsCredentials,
} from "@/lib/aws-signature";

// Almacenamiento de video en Amazon S3. En un despliegue (Replit incluido) el
// disco es efímero: los MP4 guardados en `~/.icaza-live/media` desaparecen en
// cada reinicio. Con S3 configurado, los videos sobreviven al redespliegue.

export function readS3Config(): { credentials: AwsCredentials; bucket: string } | null {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET;
  if (!region || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    credentials: {
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
    bucket,
  };
}

function bucketHost(bucket: string, region: string): string {
  return `${bucket}.s3.${region}.amazonaws.com`;
}

function objectPath(key: string): string {
  return `/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export type S3Result = { ok: true } | { ok: false; error: string };

// El cuerpo se firma como UNSIGNED-PAYLOAD para poder subir en streaming: un
// video de 1 GB no cabe en memoria para calcular su hash por adelantado.
// HTTPS protege la integridad del tránsito.
export async function putVideo(
  config: { credentials: AwsCredentials; bucket: string },
  key: string,
  body: ReadableStream<Uint8Array>,
  contentLength: number,
): Promise<S3Result> {
  const host = bucketHost(config.bucket, config.credentials.region);
  const path = objectPath(key);

  const signed = signRequest({
    credentials: config.credentials,
    service: "s3",
    host,
    method: "PUT",
    path,
    payloadHash: "UNSIGNED-PAYLOAD",
    extraHeaders: {
      "content-type": "video/mp4",
      "content-length": String(contentLength),
    },
  });

  try {
    const response = await fetch(signed.url, {
      method: "PUT",
      headers: signed.headers,
      body,
      // Node exige declarar el modo dúplex al enviar un stream como cuerpo.
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `S3 ${response.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fallo de red con S3.",
    };
  }
}

// URL temporal para que el navegador descargue el video directamente de S3.
// Una hora cubre de sobra la reproducción de un evento sin dejar el objeto
// accesible de forma indefinida.
export function videoPlaybackUrl(
  config: { credentials: AwsCredentials; bucket: string },
  key: string,
  expiresInSeconds = 3600,
): string {
  return presignUrl({
    credentials: config.credentials,
    service: "s3",
    host: bucketHost(config.bucket, config.credentials.region),
    method: "GET",
    path: objectPath(key),
    expiresInSeconds,
  });
}

export async function deleteVideo(
  config: { credentials: AwsCredentials; bucket: string },
  key: string,
): Promise<S3Result> {
  const host = bucketHost(config.bucket, config.credentials.region);
  const path = objectPath(key);
  const signed = signRequest({
    credentials: config.credentials,
    service: "s3",
    host,
    method: "DELETE",
    path,
    payloadHash: "UNSIGNED-PAYLOAD",
  });

  try {
    const response = await fetch(signed.url, {
      method: "DELETE",
      headers: signed.headers,
    });
    // S3 responde 204 al borrar y también cuando el objeto ya no existía.
    if (!response.ok && response.status !== 404) {
      const detail = await response.text();
      return { ok: false, error: `S3 ${response.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fallo de red con S3.",
    };
  }
}
