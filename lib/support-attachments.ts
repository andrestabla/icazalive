import { getDb } from "@/db";
import { supportAttachments } from "@/db/schema";
import { putObject, readS3Config } from "@/lib/aws-s3";
import { UPLOAD_SCOPES } from "@/lib/uploads";

export type Uploader = { userId: string | null; name: string; role: "requester" | "agent" };

// Guarda una evidencia de soporte en S3 (support/<caso>/) y la registra.
export async function storeSupportAttachments(
  form: FormData,
  ticketId: string,
  uploader: Uploader,
  messageId: string | null = null,
): Promise<{ ok: true; files: { id: string; fileName: string }[] } | { ok: false; error: string; status: number }> {
  const scope = UPLOAD_SCOPES.support;
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) return { ok: false, error: "Adjunta al menos un archivo.", status: 400 };
  if (files.length > 5) return { ok: false, error: "Máximo 5 archivos por envío.", status: 400 };
  for (const file of files) {
    if (file.size > scope.maxBytes) {
      return { ok: false, error: `“${file.name}” supera el máximo de ${Math.round(scope.maxBytes / 1024 / 1024)} MB.`, status: 400 };
    }
    if (!scope.accept.test((file.type || "").toLowerCase())) {
      return { ok: false, error: `El tipo de archivo de “${file.name}” no se admite (imágenes, PDF, video, texto u Office).`, status: 400 };
    }
  }
  const s3 = readS3Config();
  if (!s3) return { ok: false, error: "Amazon S3 no está configurado en el servidor.", status: 409 };

  const db = getDb();
  const stored: { id: string; fileName: string }[] = [];
  for (const file of files) {
    const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "evidencia";
    const key = `support/${ticketId}/${Date.now().toString(36)}-${safe}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await putObject(s3, key, bytes, bytes.byteLength, file.type.toLowerCase());
    if (!result.ok) return { ok: false, error: `No fue posible guardar “${file.name}”: ${result.error}`, status: 502 };
    const [row] = await db
      .insert(supportAttachments)
      .values({
        requestId: ticketId,
        messageId,
        s3Key: key,
        fileName: file.name.slice(0, 200),
        contentType: file.type.toLowerCase(),
        sizeBytes: bytes.byteLength,
        uploadedByUserId: uploader.userId,
        uploadedByName: uploader.name,
        uploadedByRole: uploader.role,
      })
      .returning({ id: supportAttachments.id, fileName: supportAttachments.fileName });
    stored.push(row);
  }
  return { ok: true, files: stored };
}
