#!/usr/bin/env python3
"""Metadatos Open Graph de la página de registro (miniatura al compartir).
Añade generateMetadata al final de app/register/[slug]/page.tsx. Idempotente."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/register/[slug]/page.tsx"; s = p.read_text()
if "generateMetadata" in s:
    if "metadataBase" not in s:
        s = s.replace('if (!event) return { title: "Evento no encontrado" };', 'if (!event) return { title: "Evento no encontrado", metadataBase: new URL(getPublicOriginFromEnv()) };')
        s = s.replace('  return {\n    title: `${event.title} · ${brand.organizationName}`,', '  return {\n    metadataBase: new URL(origin),\n    title: `${event.title} · ${brand.organizationName}`,')
        p.write_text(s); print("OK register page.tsx: metadataBase añadido"); sys.exit(0)
    print("OK register page.tsx: metadata ya presente"); sys.exit(0)
if 'import type { Metadata } from "next";' not in s:
    s = 'import type { Metadata } from "next";\n' + s
if "getPublicOriginFromEnv" not in s:
    s = s.replace('import { fileUrl } from "@/lib/uploads";', 'import { fileUrl } from "@/lib/uploads";\nimport { getPublicOriginFromEnv } from "@/lib/public-origin";', 1)
s = s.rstrip("\n") + '''

// Vista previa del enlace en WhatsApp, LinkedIn, X e Instagram: título del
// evento, fecha y miniatura (opengraph-image.tsx en esta misma carpeta).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [event] = await getDb()
    .select({ title: events.title, description: events.description, startsAt: events.startsAt, timezone: events.timezone })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) return { title: "Evento no encontrado", metadataBase: new URL(getPublicOriginFromEnv()) };
  const brand = await getBrandSettings();
  const when = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: event.timezone }).format(event.startsAt);
  const description = event.description?.trim() || `Regístrate y recibe tu acceso personal. ${when} (hora de Miami).`;
  const origin = getPublicOriginFromEnv();
  const url = `${origin}/register/${slug}`;
  return {
    metadataBase: new URL(origin),
    title: `${event.title} · ${brand.organizationName}`,
    description,
    openGraph: {
      title: event.title,
      description,
      url,
      siteName: brand.organizationName,
      type: "website",
      locale: "es_CO",
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: event.title }],
    },
    twitter: { card: "summary_large_image", title: event.title, description, images: [`${url}/opengraph-image`] },
  };
}
'''
p.write_text(s); print("OK register page.tsx: generateMetadata")
