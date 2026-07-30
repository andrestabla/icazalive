import { getBrandSettings } from "@/lib/brand";
import BrandEditor from "./brand-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marca — Icaza Live",
};

export default async function BrandPage() {
  return <BrandEditor initialBrand={await getBrandSettings()} />;
}
