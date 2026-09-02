import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { contentAssets } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { copyObject, deleteVideo, listVideos, objectPlaybackUrl, readS3Config, statVideo } from "@/lib/aws-s3";

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


// Renombra un contenido: título en la biblioteca y clave del objeto en S3
// (copia a la clave nueva y borra la anterior). Los eventos lo referencian por
// id, así que no pierden la asignación.
export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { id?: string; title?: string };
  const title = body.title?.trim().replace(/\s+/g, " ") ?? "";
  if (!body.id || title.length < 2 || title.length > 120) {
    return NextResponse.json({ error: "Indica un nombre de 2 a 120 caracteres." }, { status: 400 });
  }
  const db = getDb();
  const [asset] = await db.select().from(contentAssets).where(eq(contentAssets.id, body.id)).limit(1);
  if (!asset) return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });

  const s3 = readS3Config();
  if (!s3) return NextResponse.json({ error: "Amazon S3 no está configurado." }, { status: 409 });

  const extension = (asset.s3Key.match(/\.[A-Za-z0-9]{2,5}$/) ?? [".mp4"])[0];
  const safe = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "contenido";
  const directory = asset.s3Key.includes("/") ? asset.s3Key.slice(0, asset.s3Key.lastIndexOf("/") + 1) : "content/";
  const stamp = asset.s3Key.split("/").pop()?.match(/^([a-z0-9]{6,10})-/)?.[1] ?? Date.now().toString(36);
  const newKey = `${directory}${stamp}-${safe}${extension}`;

  if (newKey !== asset.s3Key) {
    const copied = await copyObject(s3, asset.s3Key, newKey);
    if (!copied.ok) {
      return NextResponse.json({ error: `No fue posible renombrar en S3: ${copied.error}` }, { status: 502 });
    }
    await deleteVideo(s3, asset.s3Key);
  }

  const [updated] = await db
    .update(contentAssets)
    .set({ title, s3Key: newKey, updatedAt: new Date() })
    .where(eq(contentAssets.id, asset.id))
    .returning();
  await writeAuditLog({
    actor: auth.user,
    action: "content_asset.renamed",
    resourceType: "content_asset",
    resourceId: asset.id,
    summary: `Contenido “${asset.title}” renombrado a “${title}”.`,
    details: { previousKey: asset.s3Key, s3Key: newKey },
    request,
  });
  return NextResponse.json({ data: updated });
}
