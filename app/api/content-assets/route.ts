import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { contentAssets } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { listVideos, readS3Config, statVideo } from "@/lib/aws-s3";

export const runtime = "nodejs";

async function requireStaff() {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (user.role === "participant") {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }
  return { user };
}

// Lista la biblioteca de contenidos registrada. Si S3 está configurado,
// incluye además los objetos del bucket que aún no se han registrado, para
// que el gestor pueda incorporarlos con un clic.
export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const db = getDb();
  const registered = await db
    .select()
    .from(contentAssets)
    .orderBy(desc(contentAssets.createdAt));

  const s3 = readS3Config();
  let unregistered: { s3Key: string; sizeBytes: number }[] = [];
  if (s3) {
    // content/ es el directorio actual; library/ conserva subidas anteriores.
    const listings = await Promise.all([
      listVideos(s3, "content/"),
      listVideos(s3, "library/"),
    ]);
    const objects = listings.flatMap((listing) => (listing.ok ? listing.objects : []));
    if (objects.length > 0) {
      const known = new Set(registered.map((asset) => asset.s3Key));
      unregistered = objects
        .filter((object) => !known.has(object.key))
        .map((object) => ({ s3Key: object.key, sizeBytes: object.size }));
    }
  }

  return NextResponse.json({
    data: {
      assets: registered,
      unregistered,
      s3Configured: Boolean(s3),
    },
  });
}

// Registra un objeto de S3 en la biblioteca (con título editable).
export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    s3Key?: string;
    description?: string;
    durationSeconds?: number;
  };
  const title = body.title?.trim();
  const s3Key = body.s3Key?.trim();
  if (!title || !s3Key || title.length > 200 || s3Key.length > 500) {
    return NextResponse.json(
      { error: "Indica un título y la clave del objeto en S3." },
      { status: 400 },
    );
  }

  const s3 = readS3Config();
  if (!s3) {
    return NextResponse.json(
      { error: "S3 no está configurado en el servidor." },
      { status: 409 },
    );
  }
  const stat = await statVideo(s3, s3Key);
  if (!stat.ok) {
    return NextResponse.json(
      { error: `El objeto no existe en el bucket: ${stat.error}` },
      { status: 404 },
    );
  }

  const durationSeconds =
    typeof body.durationSeconds === "number" &&
    Number.isFinite(body.durationSeconds) &&
    body.durationSeconds > 0
      ? Math.round(body.durationSeconds)
      : null;

  const db = getDb();
  const [asset] = await db
    .insert(contentAssets)
    .values({
      title,
      description: body.description?.trim() || null,
      s3Key,
      sizeBytes: stat.size,
      durationSeconds,
      createdBy: auth.user.id,
    })
    .onConflictDoUpdate({
      target: contentAssets.s3Key,
      set: { title, sizeBytes: stat.size, updatedAt: new Date() },
    })
    .returning();

  await writeAuditLog({
    actor: auth.user,
    action: "content_asset.registered",
    resourceType: "content_asset",
    resourceId: asset.id,
    summary: `Contenido “${title}” registrado en la biblioteca.`,
    details: { s3Key, sizeBytes: stat.size },
    request,
  });
  return NextResponse.json({ data: { asset } });
}

// Elimina un contenido de la biblioteca (no borra el objeto de S3).
export async function DELETE(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el identificador." }, { status: 400 });
  }
  const db = getDb();
  const [removed] = await db
    .delete(contentAssets)
    .where(eq(contentAssets.id, id))
    .returning();
  if (!removed) {
    return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });
  }
  await writeAuditLog({
    actor: auth.user,
    action: "content_asset.removed",
    resourceType: "content_asset",
    resourceId: removed.id,
    summary: `Contenido “${removed.title}” retirado de la biblioteca.`,
    request,
  });
  return NextResponse.json({ data: { removed: true } });
}
