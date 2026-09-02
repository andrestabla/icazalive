import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { getBrandSettings } from "@/lib/brand";
import BrandEditor from "./brand-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marca — Icaza Jammoul Live",
};

export default async function BrandPage() {
  // La vista previa apunta a un evento real: si no hay ninguno, el botón se
  // oculta en lugar de enlazar a una página inexistente.
  const [brand, [latestEvent]] = await Promise.all([
    getBrandSettings(),
    getDb()
      .select({ slug: events.slug })
      .from(events)
      .orderBy(desc(events.createdAt))
      .limit(1),
  ]);

  return (
    <BrandEditor
      initialBrand={brand}
      previewEventSlug={latestEvent?.slug ?? null}
    />
  );
}
