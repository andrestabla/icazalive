import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { presignUploadUrl, readS3Config } from "@/lib/aws-s3";
import {
  UPLOAD_SCOPES,
  buildUploadKey,
  fileUrl,
  isUploadScope,
} from "@/lib/uploads";

export const runtime = "nodejs";

// URL prefirmada para que el navegador suba un archivo directamente a S3
// (PUT) bajo el directorio del módulo que lo pide: brand/, participants/,
// content/. El archivo no pasa por el servidor ni nadie toca la consola AWS.
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role === "participant") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    scope?: string;
    filename?: string;
    contentType?: string;
    sizeBytes?: number;
  };
  if (!isUploadScope(body.scope)) {
    return NextResponse.json({ error: "Módulo de subida no válido." }, { status: 400 });
  }
  const scope = UPLOAD_SCOPES[body.scope];
  const filename = (body.filename ?? "").trim();
  if (!filename || filename.length > 200) {
    return NextResponse.json({ error: "Indica el nombre del archivo." }, { status: 400 });
  }
  const contentType = (body.contentType ?? "").trim().toLowerCase();
  if (!scope.accept.test(contentType)) {
    return NextResponse.json(
      { error: `Ese tipo de archivo no se admite en ${scope.label}.` },
      { status: 400 },
    );
  }
  if (typeof body.sizeBytes === "number" && body.sizeBytes > scope.maxBytes) {
    return NextResponse.json(
      { error: `El archivo supera el máximo de ${Math.round(scope.maxBytes / 1024 / 1024)} MB.` },
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

  const key = buildUploadKey(body.scope, filename);
  const uploadUrl = presignUploadUrl(s3, key, 900);

  await writeAuditLog({
    actor: user,
    action: "upload.requested",
    resourceType: "file",
    resourceId: key,
    summary: `Subida preparada en ${scope.prefix}: ${filename.slice(0, 80)}.`,
    details: { scope: body.scope, contentType, sizeBytes: body.sizeBytes ?? null },
    request,
  });

  return NextResponse.json({
    data: { uploadUrl, key, url: fileUrl(key), contentType },
  });
}
