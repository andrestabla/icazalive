import { getDb } from "@/db";
import { brandSettings } from "@/db/schema";
import { DEFAULT_BRAND, type PublicBrand } from "@/lib/brand-config";

export async function getBrandSettings(): Promise<PublicBrand> {
  const [record] = await getDb().select().from(brandSettings).limit(1);
  if (!record) return DEFAULT_BRAND;

  return {
    organizationName: record.organizationName,
    markText: record.markText,
    logoUrl: record.logoUrl,
    primaryColor: record.primaryColor,
    accentColor: record.accentColor,
    backgroundColor: record.backgroundColor,
    registrationButtonLabel: record.registrationButtonLabel,
    footerText: record.footerText,
  };
}
