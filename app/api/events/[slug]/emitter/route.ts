import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { contentAssets, events, sessions } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { canManageEvent } from "@/lib/event-permissions";
import { createEventChannel, readIvsCredentials } from "@/lib/aws-ivs";
import {
  describeEmitter,
  readEcsConfig,
  startEmitter,
  stopEmitter,
} from "@/lib/aws-ecs";
import {
  objectPlaybackUrl,
  readS3Config,
  videoPlaybackUrl,
} from "@/lib/aws-s3";
import { recordedVideoFilename } from "@/lib/media-storage";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ slug: string }> };

async function resolveManaged(slug: string) {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (user.role === "participant") {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }
  const [record] = await getDb()
    .select({ event: events, session: sessions })
    .from(events)
    .innerJoin(sessions, eq(sessions.eventId, events.id))
    .where(eq(events.slug, slug))
    .orderBy(sessions.startsAt)
    .limit(1);
  if (!record) {
    return { error: NextResponse.json({ error: "Evento no encontrado." }, { status: 404 }) };
  }
  if (!(await canManageEvent(user, record.event.id))) {
    return {
      error: NextResponse.json({ error: "No eres organizador de este evento." }, { status: 403 }),
    };
  }
  return { user, ...record };
}

async function resolveSourceUrl(
  event: typeof events.$inferSelect,
): Promise<string | null> {
  const s3 = readS3Config();
  if (!s3) return null;
  if (event.contentAssetId) {
    const [asset] = await getDb()
      .select()
      .from(contentAssets)
      .where(eq(contentAssets.id, event.contentAssetId))
      .limit(1);
    if (asset) return objectPlaybackUrl(s3, asset.s3Key, 6 * 3600);
  }
  if (event.recordedVideoPath) {
    return videoPlaybackUrl(
      s3,
      `event-videos/${recordedVideoFilename(event.id)}`,
      6 * 3600,
    );
  }
  return null;
}

export async function GET(_: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManaged(slug);
  if ("error" in resolved) return resolved.error;
  const { session } = resolved;

  let liveState = session.emitterStatus;
  const ecs = readEcsConfig();
  if (ecs && session.emitterTaskArn && session.emitterStatus === "running") {
    const described = await describeEmitter(ecs, session.emitterTaskArn);
    if (described.ok && described.state === "stopped") {
      liveState = "stopped";
      await getDb()
        .update(sessions)
        .set({ emitterStatus: "stopped", updatedAt: new Date() })
        .where(eq(sessions.id, session.id));
    }
  }
  return NextResponse.json({
    data: {
      status: liveState,
      ecsConfigured: Boolean(ecs),
      startedAt: session.emitterStartedAt,
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManaged(slug);
  if ("error" in resolved) return resolved.error;
  const { user, event, session } = resolved;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "start" | "stop";
    loop?: boolean;
  };

  const ecs = readEcsConfig();
  if (!ecs) {
    return NextResponse.json(
      {
        error:
          "Falta configurar el emisor: AWS_ECS_CLUSTER, AWS_ECS_EMITTER_TASK, AWS_ECS_SUBNETS y AWS_ECS_SECURITY_GROUPS.",
      },
      { status: 409 },
    );
  }

  if (body.action === "stop") {
    if (!session.emitterTaskArn) {
      return NextResponse.json({ error: "No hay emisión activa." }, { status: 409 });
    }
    const stopped = await stopEmitter(ecs, session.emitterTaskArn);
    await getDb()
      .update(sessions)
      .set({ emitterStatus: "stopped", updatedAt: new Date() })
      .where(eq(sessions.id, session.id));
    await writeAuditLog({
      actor: user,
      action: "emitter.stopped",
      resourceType: "session",
      resourceId: session.id,
      summary: `Emisión simulada detenida en “${event.title}”.`,
      request,
    });
    return stopped.ok
      ? NextResponse.json({ data: { status: "stopped" } })
      : NextResponse.json({ error: stopped.error }, { status: 502 });
  }

  const ivs = readIvsCredentials();
  if (!ivs) {
    return NextResponse.json(
      { error: "Faltan credenciales de AWS/IVS en el servidor." },
      { status: 409 },
    );
  }
  const sourceUrl = await resolveSourceUrl(event);
  if (!sourceUrl) {
    return NextResponse.json(
      { error: "El evento no tiene contenido asignado ni S3 configurado." },
      { status: 409 },
    );
  }

  const channel = await createEventChannel(ivs, {
    name: `icaza-sim-${event.slug}`,
    recordingConfigurationArn:
      process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined,
  });
  if (!channel.ok) {
    return NextResponse.json(
      { error: `No fue posible preparar el canal: ${channel.error}` },
      { status: 502 },
    );
  }

  const launched = await startEmitter(ecs, {
    sourceUrl,
    ingestEndpoint: channel.channel.ingestEndpoint,
    streamKey: channel.channel.streamKey,
    loop: body.loop ?? false,
  });
  if (!launched.ok) {
    return NextResponse.json(
      { error: `No fue posible iniciar el emisor: ${launched.error}` },
      { status: 502 },
    );
  }

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
    actor: user,
    action: "emitter.started",
    resourceType: "session",
    resourceId: session.id,
    summary: `Emisión simulada iniciada en “${event.title}”.`,
    details: { taskArn: launched.taskArn },
    request,
  });
  return NextResponse.json({
    data: { status: "running", playbackUrl: channel.channel.playbackUrl },
  });
}
