import { NextResponse } from "next/server";
import { objectPlaybackUrl, readS3Config } from "@/lib/aws-s3";
import { isPublicFileKey } from "@/lib/uploads";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ key: string[] }> };

// Sirve los recursos públicos de marca guardados en S3 (logos, favicon,
// loader) sin exponer el bucket: la app firma la lectura y reenvía el objeto.
// Cada subida usa una clave nueva, así que la respuesta puede cachearse
// de forma agresiva.
async function serve(request: Request, context: RouteContext, headOnly: boolean) {
  const { key: segments } = await context.params;
  const key = segments.map(decodeURIComponent).join("/");
  if (!isPublicFileKey(key)) {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }
  const s3 = readS3Config();
  if (!s3) {
    return NextResponse.json({ error: "Almacenamiento no configurado." }, { status: 503 });
  }

  const upstream = await fetch(objectPlaybackUrl(s3, key, 300), {
    method: headOnly ? "HEAD" : "GET",
    headers: request.headers.get("range")
      ? { range: request.headers.get("range")! }
      : undefined,
  });
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  // Los archivos subidos se sirven como contenido inerte: sin scripts ni
  // acceso al origen de la aplicación aunque el tipo declarado sea HTML/SVG.
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src data:; media-src 'self'");
  headers.set("X-Content-Type-Options", "nosniff");
  const upstreamType = headers.get("content-type") ?? "";
  if (/svg|html|xml|javascript/i.test(upstreamType)) {
    headers.set("Content-Disposition", "attachment");
  }
  return new Response(headOnly ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

export function GET(request: Request, context: RouteContext) {
  return serve(request, context, false);
}

export function HEAD(request: Request, context: RouteContext) {
  return serve(request, context, true);
}
