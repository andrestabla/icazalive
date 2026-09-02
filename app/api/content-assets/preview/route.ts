import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { contentAssets } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { objectPlaybackUrl, readS3Config } from "@/lib/aws-s3";

export const runtime = "nodejs";

// URL firmada de corta duración para previsualizar un contenido de la
// biblioteca desde el panel (solo personal).
export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user || user.role === "participant") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el identificador." }, { status: 400 });
  const [asset] = await getDb().select().from(contentAssets).where(eq(contentAssets.id, id)).limit(1);
  if (!asset) return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });
  const s3 = readS3Config();
  if (!s3) return NextResponse.json({ error: "Amazon S3 no está configurado." }, { status: 409 });
  return NextResponse.json(
    { data: { url: objectPlaybackUrl(s3, asset.s3Key, 3600), contentType: asset.contentType } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
