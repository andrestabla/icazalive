import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { contentAssets, events, sessions } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import type { AuthenticatedUser } from "@/lib/auth";
import { createEventChannel, readIvsCredentials } from "@/lib/aws-ivs";
import { describeEmitter, readEcsConfig, startEmitter, stopEmitter } from "@/lib/aws-ecs";
import { objectPlaybackUrl, readS3Config } from "@/lib/aws-s3";

// Emisor S3 → IVS para contenido simulado. El contenido vive en la biblioteca
// (Contenidos) y siempre se entrega vía Amazon IVS: la misma experiencia y la
// misma velocidad de carga que un evento en vivo, para cualquier audiencia.

type EventRow = typeof events.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

export type EmitterResult =
  | { ok: true; status: "running" | "stopped"; playbackUrl?: string | null }
  | { ok: false; error: string; code: 409 | 502 };

async function mainSession(eventId: string): Promise<SessionRow | null> {
  const [session] = await getDb()
    .select()
    .from(sessions)
    .where(eq(sessions.eventId, eventId))
    .orderBy(sessions.startsAt)
    .limit(1);
  return session ?? null;
}

async function librarySourceUrl(event: EventRow): Promise<string | null> {
  const s3 = readS3Config();
  if (!s3 || !event.contentAssetId) return null;
  const [asset] = await getDb()
    .select()
    .from(contentAssets)
    .where(eq(contentAssets.id, event.contentAssetId))
    .limit(1);
  return asset ? objectPlaybackUrl(s3, asset.s3Key, 6 * 3600) : null;
}

export async function startEventEmitter(
  event: EventRow,
  options: { actor?: AuthenticatedUser | null; request?: Request; automatic?: boolean } = {},
): Promise<EmitterResult> {
  const ecs = readEcsConfig();
  if (!ecs) {
    return { ok: false, code: 409, error: "Falta configurar el emisor: AWS_ECS_CLUSTER, AWS_ECS_EMITTER_TASK, AWS_ECS_SUBNETS y AWS_ECS_SECURITY_GROUPS." };
  }
  const ivs = readIvsCredentials();
  if (!ivs) return { ok: false, code: 409, error: "Faltan credenciales de AWS/IVS en el servidor." };
  const session = await mainSession(event.id);
  if (!session) return { ok: false, code: 409, error: "El evento no tiene sesión principal." };
  if (session.emitterStatus === "running" && session.emitterTaskArn) {
    return { ok: true, status: "running", playbackUrl: session.playbackUrl };
  }
  const sourceUrl = await librarySourceUrl(event);
  if (!sourceUrl) {
    return { ok: false, code: 409, error: "El evento no tiene contenido de la biblioteca asignado (Contenidos)." };
  }

  const channel = await createEventChannel(ivs, {
    name: `icaza-sim-${event.slug}`,
    recordingConfigurationArn: process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined,
  });
  if (!channel.ok) return { ok: false, code: 502, error: `No fue posible preparar el canal: ${channel.error}` };

  const launched = await startEmitter(ecs, {
    sourceUrl,
    ingestEndpoint: channel.channel.ingestEndpoint,
    streamKey: channel.channel.streamKey,
    loop: false,
  });
  if (!launched.ok) return { ok: false, code: 502, error: `No fue posible iniciar el emisor: ${launched.error}` };

  const now = new Date();
  await getDb()
    .update(sessions)
    .set({
      emitterStatus: "running",
      emitterTaskArn: launched.taskArn,
      emitterStartedAt: now,
      ivsChannelArn: channel.channel.channelArn,
      playbackUrl: channel.channel.playbackUrl,
      streamingStatus: "live",
      updatedAt: now,
    })
    .where(eq(sessions.id, session.id));
  await writeAuditLog({
    actor: options.actor ?? undefined,
    action: options.automatic ? "emitter.auto_started" : "emitter.started",
    resourceType: "session",
    resourceId: session.id,
    summary: `Emisión simulada ${options.automatic ? "iniciada automáticamente" : "iniciada"} en “${event.title}”.`,
    details: { taskArn: launched.taskArn },
    request: options.request,
  });
  return { ok: true, status: "running", playbackUrl: channel.channel.playbackUrl };
}

export async function stopEventEmitter(
  event: EventRow,
  options: { actor?: AuthenticatedUser | null; request?: Request; automatic?: boolean } = {},
): Promise<EmitterResult> {
  const ecs = readEcsConfig();
  if (!ecs) return { ok: false, code: 409, error: "El emisor no está configurado en el servidor." };
  const session = await mainSession(event.id);
  if (!session?.emitterTaskArn) return { ok: false, code: 409, error: "No hay emisión activa." };
  const stopped = await stopEmitter(ecs, session.emitterTaskArn);
  await getDb()
    .update(sessions)
    .set({ emitterStatus: "stopped", updatedAt: new Date() })
    .where(eq(sessions.id, session.id));
  await writeAuditLog({
    actor: options.actor ?? undefined,
    action: options.automatic ? "emitter.auto_stopped" : "emitter.stopped",
    resourceType: "session",
    resourceId: session.id,
    summary: `Emisión simulada ${options.automatic ? "detenida automáticamente" : "detenida"} en “${event.title}”.`,
    request: options.request,
  });
  return stopped.ok ? { ok: true, status: "stopped" } : { ok: false, code: 502, error: stopped.error ?? "No fue posible detener el emisor." };
}

// Automatización: el planificador la ejecuta cada minuto. Un evento simulado
// arranca solo a su hora (un híbrido, en el minuto de transición) y pasa a
// EN VIVO; al terminar, se detiene el emisor y el evento queda completado.
export async function runSimulatedAutomation(): Promise<{ started: number; stopped: number }> {
  const db = getDb();
  const now = new Date();
  const summary = { started: 0, stopped: 0 };
  if (!readEcsConfig()) return summary;

  const candidates = await db
    .select()
    .from(events)
    .where(
      and(
        inArray(events.format, ["simulated", "hybrid"]),
        inArray(events.status, ["registration_open", "preparing", "live"]),
        isNotNull(events.contentAssetId),
        lte(events.startsAt, now),
      ),
    );

  for (const event of candidates) {
    const session = await mainSession(event.id);
    if (!session) continue;
    const switchAt =
      event.format === "hybrid" && event.hybridSwitchOffsetMinutes !== null
        ? new Date(event.startsAt.getTime() + event.hybridSwitchOffsetMinutes * 60_000)
        : event.startsAt;
    const endsAt = event.endsAt;
    const running = session.emitterStatus === "running";

    if (now >= switchAt && now < endsAt && !running && session.emitterStatus !== "error") {
      // Evita relanzar si la tarea anterior ya terminó (video más corto que el evento).
      if (session.emitterStatus === "stopped" && session.emitterStartedAt && session.emitterStartedAt >= switchAt) continue;
      const result = await startEventEmitter(event, { automatic: true });
      if (result.ok) {
        summary.started += 1;
        if (event.status !== "live") {
          await db.update(events).set({ status: "live", updatedAt: new Date() }).where(eq(events.id, event.id));
        }
      } else {
        await db.update(sessions).set({ emitterStatus: "error", updatedAt: new Date() }).where(eq(sessions.id, session.id));
        await writeAuditLog({
          action: "emitter.auto_start_failed",
          resourceType: "event",
          resourceId: event.id,
          outcome: "failure",
          summary: `No se pudo iniciar la emisión simulada de “${event.title}”: ${result.error}`,
        });
      }
      continue;
    }

    if (now >= endsAt) {
      if (running) {
        const ecs = readEcsConfig()!;
        const described = session.emitterTaskArn ? await describeEmitter(ecs, session.emitterTaskArn) : null;
        if (!described || !described.ok || described.state !== "stopped") {
          await stopEventEmitter(event, { automatic: true });
        } else {
          await db.update(sessions).set({ emitterStatus: "stopped", updatedAt: new Date() }).where(eq(sessions.id, session.id));
        }
        summary.stopped += 1;
      }
      if (event.status === "live") {
        await db.update(events).set({ status: "completed", updatedAt: new Date() }).where(eq(events.id, event.id));
        await writeAuditLog({
          action: "event.simulated.ended",
          resourceType: "event",
          resourceId: event.id,
          summary: `El evento simulado “${event.title}” terminó y quedó completado.`,
        });
      }
    }
  }
  return summary;
}
