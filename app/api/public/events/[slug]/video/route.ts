import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  recordedVideoAbsolutePath,
  recordedVideoRemoteUrl,
  recordedVideoStats,
} from "@/lib/media-storage";
import {
  getBearerToken,
  resolveRegistrationAccess,
} from "@/lib/registration-access";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  const token =
    getBearerToken(request) ||
    new URL(request.url).searchParams.get("access") ||
    "";
  let authorized = false;
  if (token) {
    authorized = Boolean(await resolveRegistrationAccess(token, slug));
  }
  if (!authorized) {
    const user = await getCurrentUser();
    authorized = Boolean(user && user.role !== "participant");
  }
  if (!authorized) {
    return NextResponse.json(
      { error: "Necesitas un enlace personal para ver la transmisión." },
      { status: 401 },
    );
  }

  const [event] = await getDb()
    .select({
      recordedVideoPath: events.recordedVideoPath,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event?.recordedVideoPath) {
    return NextResponse.json({ error: "El evento no tiene video." }, { status: 404 });
  }

  const stats = await recordedVideoStats(event.recordedVideoPath);
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
  }

  const absolutePath = recordedVideoAbsolutePath(event.recordedVideoPath);
  const size = stats.size;
  const range = request.headers.get("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start <= end && start < size) {
        const stream = Readable.toWeb(
          createReadStream(absolutePath, { start, end }),
        ) as ReadableStream;
        return new Response(stream, {
          status: 206,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store",
          },
        });
      }
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
  }

  const stream = Readable.toWeb(createReadStream(absolutePath)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}
