import { signRequest, sha256Hex, type AwsCredentials } from "@/lib/aws-signature";

// Cliente mínimo de Amazon IVS (low-latency streaming) firmado con SigV4.
// Las credenciales se leen solo de variables de entorno del servidor y nunca
// se guardan en la base ni viajan al navegador.

export function readIvsCredentials(): AwsCredentials | null {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  return {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  };
}

type IvsError = { ok: false; error: string; status: number };

async function call<T>(
  credentials: AwsCredentials,
  action: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | IvsError> {
  const host = `ivs.${credentials.region}.amazonaws.com`;
  const path = `/${action}`;
  const payload = JSON.stringify(body);

  const signed = signRequest({
    credentials,
    service: "ivs",
    host,
    method: "POST",
    path,
    payloadHash: sha256Hex(payload),
    extraHeaders: { "content-type": "application/json" },
  });

  try {
    const response = await fetch(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: payload,
    });
    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        status: response.status,
        error: `IVS ${response.status}: ${detail.slice(0, 300)}`,
      };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error:
        error instanceof Error ? error.message : "Fallo de red con Amazon IVS.",
    };
  }
}

export type IvsStreamState =
  | { state: "live"; health: string; viewerCount: number; startedAt: string }
  | { state: "offline" }
  | { state: "unavailable"; detail: string };

// Estado real del canal: responde si la señal está entrando antes de que
// empiece el evento, que es cuando sirve saberlo. IVS devuelve 404 cuando el
// canal existe pero nadie está transmitiendo; eso no es un error.
export async function getStreamState(
  credentials: AwsCredentials,
  channelArn: string,
): Promise<IvsStreamState> {
  const result = await call<{
    stream?: {
      health?: string;
      viewerCount?: number;
      startTime?: string;
      state?: string;
    };
  }>(credentials, "GetStream", { channelArn });

  if (!result.ok) {
    if (result.status === 404) return { state: "offline" };
    return { state: "unavailable", detail: result.error };
  }

  const stream = result.data.stream;
  if (!stream || stream.state !== "LIVE") return { state: "offline" };

  return {
    state: "live",
    health: stream.health ?? "UNKNOWN",
    viewerCount: stream.viewerCount ?? 0,
    startedAt: stream.startTime ?? new Date().toISOString(),
  };
}

export type ProvisionedChannel = {
  channelArn: string;
  playbackUrl: string;
  ingestEndpoint: string;
  streamKey: string;
};

// Crea el canal del evento y devuelve todo lo necesario para transmitir. El
// stream key se entrega una sola vez a quien lo solicita y no se persiste:
// quedaría expuesto a cualquiera con acceso de lectura a la base.
export async function createEventChannel(
  credentials: AwsCredentials,
  options: { name: string; recordingConfigurationArn?: string },
): Promise<{ ok: true; channel: ProvisionedChannel } | IvsError> {
  const result = await call<{
    channel?: { arn?: string; playbackUrl?: string; ingestEndpoint?: string };
    streamKey?: { value?: string };
  }>(credentials, "CreateChannel", {
    // IVS solo admite letras, números, guion y guion bajo en el nombre.
    name: options.name.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 128),
    type: "STANDARD",
    latencyMode: "LOW",
    ...(options.recordingConfigurationArn
      ? { recordingConfigurationArn: options.recordingConfigurationArn }
      : {}),
  });

  if (!result.ok) return result;

  const channel = result.data.channel;
  const streamKey = result.data.streamKey?.value;
  if (!channel?.arn || !channel.playbackUrl || !channel.ingestEndpoint || !streamKey) {
    return {
      ok: false,
      status: 502,
      error: "IVS creó el canal pero no devolvió todos los datos esperados.",
    };
  }

  return {
    ok: true,
    channel: {
      channelArn: channel.arn,
      playbackUrl: channel.playbackUrl,
      // IVS entrega el host; Zoom necesita la URL RTMPS completa.
      ingestEndpoint: `rtmps://${channel.ingestEndpoint}:443/app/`,
      streamKey,
    },
  };
}

// Comprueba que las credenciales sirven sin crear nada, para el botón
// "Revisar" de la pantalla de Integraciones.
export async function verifyIvsAccess(
  credentials: AwsCredentials,
): Promise<{ ok: boolean; detail: string; channelCount?: number }> {
  const result = await call<{ channels?: unknown[] }>(
    credentials,
    "ListChannels",
    { maxResults: 1 },
  );
  if (!result.ok) {
    return {
      ok: false,
      detail:
        result.status === 403
          ? "Las credenciales no tienen permiso ivs:ListChannels."
          : result.error,
    };
  }
  return {
    ok: true,
    detail: "Credenciales de Amazon IVS válidas.",
    channelCount: result.data.channels?.length ?? 0,
  };
}
