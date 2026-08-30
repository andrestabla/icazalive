import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser, type AuthenticatedUser } from "@/lib/auth";
import { canManageEvent } from "@/lib/event-permissions";
import {
  deleteRecordedVideo,
  saveRecordedVideo,
  statRemoteVideo,
  VideoValidationError,
} from "@/lib/media-storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

async function resolveManagedEvent(
  slug: string,
): Promise<
  | { error: NextResponse }
  | { user: AuthenticatedUser; event: typeof events.$inferSelect }
> {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (user.role === "participant") {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }
  const [event] = await getDb()
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return { error: NextResponse.json({ error: "Evento no encontrado." }, { status: 404 }) };
  }
  if (!(await canManageEvent(user, event.id))) {
    return {
      error: NextResponse.json(
        { error: "No eres organizador de este evento." },
        { status: 403 },
      ),
    };
  }
  return { user, event };
}

export async function GET(_: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManagedEvent(slug);
  if ("error" in resolved) return resolved.error;
  const { event } = resolved;

  return NextResponse.json({
    data: {
      hasVideo: Boolean(event.recordedVideoPath),
      name: event.recordedVideoName,
      size: event.recordedVideoSize,
      durationSeconds: event.recordedVideoDurationSeconds,
      uploadedAt: event.recordedVideoUploadedAt,
      postEventRedirectUrl: event.postEventRedirectUrl,
    },
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManagedEvent(slug);
  if ("error" in resolved) return resolved.error;
  const { user, event } = resolved;

  if (event.format !== "simulated") {
    return NextResponse.json(
      { error: "Solo los eventos simulados usan video pregrabado." },
      { status: 409 },
    );
  }
  if (!request.body) {
    return NextResponse.json({ error: "No se recibió el archivo." }, { status: 400 });
  }

  const url = new URL(request.url);
  const originalName = (url.searchParams.get("name") ?? "video.mp4").slice(0, 200);
  const duration = Number(url.searchParams.get("duration"));
  const durationSeconds =
    Number.isFinite(duration) && duration > 0 && duration < 24 * 60 * 60
      ? Math.round(duration)
      : null;

  try {
    const saved = await saveRecordedVideo(event.id, request.body);
    const [updated] = await getDb()
      .update(events)
      .set({
        recordedVideoPath: saved.filename,
        recordedVideoName: originalName,
        recordedVideoSize: saved.size,
        recordedVideoDurationSeconds: durationSeconds,
        recordedVideoUploadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id))
      .returning();

    await writeAuditLog({
      actor: user,
      action: "event.video.uploaded",
      resourceType: "event",
      resourceId: event.id,
      summary: `Video pregrabado cargado para “${event.title}”.`,
      details: {
        name: originalName,
        size: saved.size,
        durationSeconds,
      },
      request,
    });
    return NextResponse.json({
      data: {
        hasVideo: true,
        name: updated.recordedVideoName,
        size: updated.recordedVideoSize,
        durationSeconds: updated.recordedVideoDurationSeconds,
        uploadedAt: updated.recordedVideoUploadedAt,
      },
    });
  } catch (error) {
    if (error instanceof VideoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

// Registra un video que el administrador cargó directamente en S3 con la
// clave event-videos/<id del evento>.mp4, sin pasar el archivo por la app.
export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManagedEvent(slug);
  if ("error" in resolved) return resolved.error;
  const { user, event } = resolved;

  if (event.format !== "simulated") {
    return NextResponse.json(
      { error: "Solo los eventos simulados usan video pregrabado." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    source?: string;
    name?: string;
    durationSeconds?: number;
  };
  if (body.source !== "s3") {
    return NextResponse.json(
      { error: "Indica source: \"s3\" para importar desde el bucket." },
      { status: 400 },
    );
  }

  const remote = await statRemoteVideo(event.id);
  if (!remote) {
    return NextResponse.json(
      {
        error: `No se encontró event-videos/${event.id}.mp4 en el bucket configurado.`,
      },
      { status: 404 },
    );
  }

  const durationSeconds =
    typeof body.durationSeconds === "number" &&
    Number.isFinite(body.durationSeconds) &&
    body.durationSeconds > 0 &&
    body.durationSeconds < 24 * 60 * 60
      ? Math.round(body.durationSeconds)
      : null;
  const originalName = (body.name ?? "video.mp4").slice(0, 200);

  const [updated] = await getDb()
    .update(events)
    .set({
      recordedVideoPath: remote.filename,
      recordedVideoName: originalName,
      recordedVideoSize: remote.size,
      recordedVideoDurationSeconds: durationSeconds,
      recordedVideoUploadedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id))
    .returning();

  await writeAuditLog({
    actor: user,
    action: "event.video.imported_from_s3",
    resourceType: "event",
    resourceId: event.id,
    summary: `Video pregrabado importado desde S3 para “${event.title}”.`,
    details: { name: originalName, size: remote.size, durationSeconds },
    request,
  });
  return NextResponse.json({
    data: {
      hasVideo: true,
      name: updated.recordedVideoName,
      size: updated.recordedVideoSize,
      durationSeconds: updated.recordedVideoDurationSeconds,
      uploadedAt: updated.recordedVideoUploadedAt,
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManagedEvent(slug);
  if ("error" in resolved) return resolved.error;
  const { user, event } = resolved;

  if (!event.recordedVideoPath) {
    return NextResponse.json({ error: "El evento no tiene video." }, { status: 404 });
  }

  await deleteRecordedVideo(event.recordedVideoPath);
  await getDb()
    .update(events)
    .set({
      recordedVideoPath: null,
      recordedVideoName: null,
      recordedVideoSize: null,
      recordedVideoDurationSeconds: null,
      recordedVideoUploadedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id));

  await writeAuditLog({
    actor: user,
    action: "event.video.deleted",
    resourceType: "event",
    resourceId: event.id,
    summary: `Video pregrabado eliminado de “${event.title}”.`,
    request,
  });
  return NextResponse.json({ data: { deleted: true } });
}
