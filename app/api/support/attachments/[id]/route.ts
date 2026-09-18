import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportAttachments, supportRequests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { objectPlaybackUrl, readS3Config } from "@/lib/aws-s3";
import { getEffectivePermissions } from "@/lib/permissions";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

// Descarga privada de una evidencia: la ve el equipo de soporte o el
// solicitante con el token de su caso. Nunca se expone el bucket.
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = getDb();
  const [row] = await db
    .select({ attachment: supportAttachments, token: supportRequests.accessToken })
    .from(supportAttachments)
    .innerJoin(supportRequests, eq(supportAttachments.requestId, supportRequests.id))
    .where(eq(supportAttachments.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });

  const token = new URL(request.url).searchParams.get("token");
  let allowed = Boolean(token && row.token && token === row.token);
  if (!allowed) {
    const user = await getCurrentUser();
    if (user && user.role !== "participant") {
      const { granted } = await getEffectivePermissions(user);
      allowed = granted.has("support.view");
    }
  }
  if (!allowed) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const s3 = readS3Config();
  if (!s3) return NextResponse.json({ error: "Almacenamiento no configurado." }, { status: 503 });
  const upstream = await fetch(objectPlaybackUrl(s3, row.attachment.s3Key, 300));
  if (!upstream.ok) return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  const headers = new Headers();
  headers.set("content-type", row.attachment.contentType);
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  const inline = /^(image\/|application\/pdf|video\/|text\/plain)/.test(row.attachment.contentType);
  headers.set("content-disposition", `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(row.attachment.fileName)}"`);
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src data:; media-src 'self'");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(upstream.body, { status: 200, headers });
}
