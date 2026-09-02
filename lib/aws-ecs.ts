import { signRequest, sha256Hex, type AwsCredentials } from "@/lib/aws-signature";

// Cliente mínimo de Amazon ECS para lanzar y detener el emisor efímero que
// empuja contenido de S3 hacia un canal de IVS por RTMP. Firmado con SigV4,
// sin SDK, mismo patrón que el resto de clientes AWS del proyecto.

export function readEcsConfig(): {
  credentials: AwsCredentials;
  cluster: string;
  taskDefinition: string;
  subnets: string[];
  securityGroups: string[];
} | null {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const cluster = process.env.AWS_ECS_CLUSTER;
  const taskDefinition = process.env.AWS_ECS_EMITTER_TASK;
  const subnets = (process.env.AWS_ECS_SUBNETS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const securityGroups = (process.env.AWS_ECS_SECURITY_GROUPS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !region ||
    !accessKeyId ||
    !secretAccessKey ||
    !cluster ||
    !taskDefinition ||
    !subnets.length ||
    !securityGroups.length
  ) {
    return null;
  }
  return {
    credentials: {
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
    cluster,
    taskDefinition,
    subnets,
    securityGroups,
  };
}

type EcsConfig = NonNullable<ReturnType<typeof readEcsConfig>>;
type EcsResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  config: EcsConfig,
  action: string,
  body: Record<string, unknown>,
): Promise<EcsResult<T>> {
  const host = `ecs.${config.credentials.region}.amazonaws.com`;
  const payload = JSON.stringify(body);
  const signed = signRequest({
    credentials: config.credentials,
    service: "ecs",
    host,
    method: "POST",
    path: "/",
    payloadHash: sha256Hex(payload),
    extraHeaders: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AmazonEC2ContainerServiceV20141113.${action}`,
    },
  });
  try {
    const response = await fetch(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: payload,
    });
    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `ECS ${response.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fallo de red con ECS.",
    };
  }
}

// Lanza el emisor: una tarea Fargate que corre ffmpeg leyendo la URL firmada
// del contenido y empujándola al ingest de IVS con la stream key. Las
// credenciales van como overrides de entorno, no se hornean en la imagen.
export async function startEmitter(
  config: EcsConfig,
  options: { sourceUrl: string; ingestEndpoint: string; streamKey: string; loop: boolean },
): Promise<{ ok: true; taskArn: string } | { ok: false; error: string }> {
  const result = await call<{ tasks?: { taskArn?: string }[]; failures?: unknown[] }>(
    config,
    "RunTask",
    {
      cluster: config.cluster,
      taskDefinition: config.taskDefinition,
      launchType: "FARGATE",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: config.subnets,
          securityGroups: config.securityGroups,
          assignPublicIp: "ENABLED",
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "emisor",
            environment: [
              { name: "SOURCE_URL", value: options.sourceUrl },
              { name: "INGEST_ENDPOINT", value: options.ingestEndpoint },
              { name: "STREAM_KEY", value: options.streamKey },
              { name: "LOOP", value: options.loop ? "1" : "0" },
            ],
          },
        ],
      },
    },
  );
  if (!result.ok) return result;
  const taskArn = result.data.tasks?.[0]?.taskArn;
  if (!taskArn) {
    return {
      ok: false,
      error: `ECS no devolvió una tarea. ${JSON.stringify(result.data.failures ?? []).slice(0, 200)}`,
    };
  }
  return { ok: true, taskArn };
}

export async function stopEmitter(
  config: EcsConfig,
  taskArn: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await call(config, "StopTask", {
    cluster: config.cluster,
    task: taskArn,
    reason: "Fin del segmento simulado en Icaza Jammoul Live.",
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export type EmitterState = "running" | "pending" | "stopped" | "unknown";

// Consulta el estado real de la tarea del emisor en ECS.
export async function describeEmitter(
  config: EcsConfig,
  taskArn: string,
): Promise<{ ok: true; state: EmitterState; detail: string } | { ok: false; error: string }> {
  const result = await call<{
    tasks?: { lastStatus?: string; stoppedReason?: string }[];
  }>(config, "DescribeTasks", { cluster: config.cluster, tasks: [taskArn] });
  if (!result.ok) return result;
  const task = result.data.tasks?.[0];
  if (!task) return { ok: true, state: "unknown", detail: "Tarea no encontrada." };
  const status = task.lastStatus ?? "UNKNOWN";
  const state: EmitterState =
    status === "RUNNING"
      ? "running"
      : status === "STOPPED"
        ? "stopped"
        : status === "PENDING" || status === "PROVISIONING"
          ? "pending"
          : "unknown";
  return { ok: true, state, detail: task.stoppedReason ?? status };
}
