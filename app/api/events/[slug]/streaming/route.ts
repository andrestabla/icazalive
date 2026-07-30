import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import {
  evaluateStreamingConfiguration,
  getCredentialAvailability,
  hasBlockingStreamingChecks,
  type StreamingMode,
} from "@/lib/streaming";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };
type NullableText = string | null;

async function requireStaff() {
  const user = await requireApiUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (user.role === "participant") {
    return {
      error: NextResponse.json({ error: "No autorizado." }, { status: 403 }),
    };
  }
  return { user };
}

function cleanNullableText(value: unknown, maxLength: number): NullableText {
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("invalid_text");
  }
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) throw new Error("invalid_text");
  return cleaned;
}

function isHttpUrl(value: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const db = getDb();
  const [record] = await db
    .select({ event: events, session: sessions })
    .from(events)
    .innerJoin(sessions, eq(sessions.eventId, events.id))
    .where(eq(events.slug, slug))
    .orderBy(sessions.startsAt)
    .limit(1);

  if (!record) {
    return NextResponse.json(
      { error: "Evento o sesión no encontrados." },
      { status: 404 },
    );
  }

  const credentials = getCredentialAvailability();
  const checks = evaluateStreamingConfiguration({
    mode: record.session.streamingMode,
    startsAt: record.session.startsAt,
    endsAt: record.session.endsAt,
    zoomMeetingId: record.session.zoomMeetingId,
    zoomJoinUrl: record.session.zoomJoinUrl,
    ivsChannelArn: record.session.ivsChannelArn,
    playbackUrl: record.session.playbackUrl,
    ...credentials,
  });

  return NextResponse.json({
    data: {
      session: record.session,
      checks,
      credentials,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const body = (await request.json()) as {
    sessionId?: string;
    action?: "save" | "run_check";
    streamingMode?: StreamingMode;
    latencyMode?: "low" | "standard";
    zoomMeetingId?: NullableText;
    zoomJoinUrl?: NullableText;
    ivsChannelArn?: NullableText;
    playbackUrl?: NullableText;
    recordingEnabled?: boolean;
  };

  const allowedModes: StreamingMode[] = [
    "zoom_only",
    "zoom_to_ivs",
    "ivs_direct",
    "simulated",
  ];
  if (
    !body.sessionId ||
    (body.action !== undefined &&
      body.action !== "save" &&
      body.action !== "run_check") ||
    (body.streamingMode !== undefined &&
      !allowedModes.includes(body.streamingMode)) ||
    (body.latencyMode !== undefined &&
      body.latencyMode !== "low" &&
      body.latencyMode !== "standard") ||
    (body.recordingEnabled !== undefined &&
      typeof body.recordingEnabled !== "boolean")
  ) {
    return NextResponse.json(
      { error: "La configuración de transmisión no es válida." },
      { status: 400 },
    );
  }

  let zoomMeetingId: NullableText | undefined;
  let zoomJoinUrl: NullableText | undefined;
  let ivsChannelArn: NullableText | undefined;
  let playbackUrl: NullableText | undefined;
  try {
    if (body.zoomMeetingId !== undefined) {
      zoomMeetingId = cleanNullableText(body.zoomMeetingId, 80);
    }
    if (body.zoomJoinUrl !== undefined) {
      zoomJoinUrl = cleanNullableText(body.zoomJoinUrl, 500);
    }
    if (body.ivsChannelArn !== undefined) {
      ivsChannelArn = cleanNullableText(body.ivsChannelArn, 500);
    }
    if (body.playbackUrl !== undefined) {
      playbackUrl = cleanNullableText(body.playbackUrl, 1000);
    }
  } catch {
    return NextResponse.json(
      { error: "Uno de los identificadores supera el tamaño permitido." },
      { status: 400 },
    );
  }

  if (
    !isHttpUrl(zoomJoinUrl ?? null) ||
    !isHttpUrl(playbackUrl ?? null) ||
    (ivsChannelArn && !ivsChannelArn.startsWith("arn:aws:ivs:"))
  ) {
    return NextResponse.json(
      { error: "Revisa las URL y el ARN del canal de Amazon IVS." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [record] = await db
    .select({ event: events, session: sessions })
    .from(events)
    .innerJoin(sessions, eq(sessions.eventId, events.id))
    .where(
      and(
        eq(events.slug, slug),
        eq(sessions.id, body.sessionId),
      ),
    )
    .limit(1);

  if (!record) {
    return NextResponse.json(
      { error: "Evento o sesión no encontrados." },
      { status: 404 },
    );
  }

  const mode = body.streamingMode ?? record.session.streamingMode;
  const merged = {
    mode,
    startsAt: record.session.startsAt,
    endsAt: record.session.endsAt,
    zoomMeetingId:
      zoomMeetingId !== undefined
        ? zoomMeetingId
        : record.session.zoomMeetingId,
    zoomJoinUrl:
      zoomJoinUrl !== undefined ? zoomJoinUrl : record.session.zoomJoinUrl,
    ivsChannelArn:
      ivsChannelArn !== undefined
        ? ivsChannelArn
        : record.session.ivsChannelArn,
    playbackUrl:
      playbackUrl !== undefined ? playbackUrl : record.session.playbackUrl,
    ...getCredentialAvailability(),
  };
  const checks = evaluateStreamingConfiguration(merged);
  const hasBlockingChecks = hasBlockingStreamingChecks(checks);
  const streamingStatus = hasBlockingChecks
    ? ("not_configured" as const)
    : body.action === "run_check"
      ? ("ready" as const)
      : ("configured" as const);
  const now = new Date();

  const [updated] = await db
    .update(sessions)
    .set({
      streamingMode: mode,
      streamingStatus,
      latencyMode: body.latencyMode ?? record.session.latencyMode,
      zoomMeetingId: merged.zoomMeetingId,
      zoomJoinUrl: merged.zoomJoinUrl,
      ivsChannelArn: merged.ivsChannelArn,
      playbackUrl: merged.playbackUrl,
      recordingEnabled:
        body.recordingEnabled ?? record.session.recordingEnabled,
      technicalCheckAt: body.action === "run_check" ? now : null,
      updatedAt: now,
    })
    .where(eq(sessions.id, record.session.id))
    .returning();

  await writeAuditLog({
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
        : `Transmisión de “${record.event.title}” actualizada.`,
    details: {
      eventId: record.event.id,
      mode: updated.streamingMode,
      status: updated.streamingStatus,
      latencyMode: updated.latencyMode,
      recordingEnabled: updated.recordingEnabled,
      blockingChecks: hasBlockingChecks,
    },
    request,
  });
  return NextResponse.json({
    data: {
      session: updated,
      checks,
      credentials: getCredentialAvailability(),
    },
  });
}
