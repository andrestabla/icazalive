import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { presignUploadUrl, readS3Config } from "@/lib/aws-s3";

export const runtime = "nodejs";

// Devuelve una URL prefirmada para que el navegador suba un video directamente
// a S3 (PUT), sin que el archivo pase por el servidor ni el gestor toque AWS.
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role === "participant") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    filename?: string;
    contentType?: string;
  };
  const filename = (body.filename ?? "").trim();
  if (!filename || filename.length > 200) {
    return NextResponse.json(
      { error: "Indica el nombre del archivo." },
      { status: 400 },
    );
  }
  const contentType = body.contentType ?? "video/mp4";
  if (!contentType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Solo se admiten archivos de video." },
      { status: 400 },
    );
  }

  const s3 = readS3Config();
  if (!s3) {
    return NextResponse.json(
      { error: "Amazon S3 no está configurado en el servidor." },
      { status: 409 },
    );
  }

  // Clave única para evitar colisiones, conservando el nombre legible.
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120);
  const stamp = Date.now().toString(36);
  // Los contenidos viven bajo content/ (directorio del módulo Contenidos).
  const key = `content/${stamp}-${safe}`;

  const uploadUrl = presignUploadUrl(s3, key, 900);

  await writeAuditLog({
    actor: user,
    action: "content_asset.upload_requested",
    resourceType: "content_asset",
    resourceId: key,
    summary: `Subida de contenido preparada: ${safe}.`,
    request,
  });

  return NextResponse.json({ data: { uploadUrl, key } });
}
