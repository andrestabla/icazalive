import { getDb } from "@/db";
import { brandSettings } from "@/db/schema";
import { DEFAULT_BRAND, type PublicBrand } from "@/lib/brand-config";
import { fileUrl } from "@/lib/uploads";

export async function getBrandSettings(): Promise<PublicBrand> {
  const [record] = await getDb().select().from(brandSettings).limit(1);
  if (!record) return DEFAULT_BRAND;

  return {
    organizationName: record.organizationName,
    markText: record.markText,
    logoUrl: record.logoUrl,
    logoLightKey: record.logoLightKey,
    logoDarkKey: record.logoDarkKey,
    faviconKey: record.faviconKey,
    loaderKey: record.loaderKey,
    logoLightUrl: fileUrl(record.logoLightKey),
    logoDarkUrl: fileUrl(record.logoDarkKey),
    faviconUrl: fileUrl(record.faviconKey),
    loaderUrl: fileUrl(record.loaderKey),
    primaryColor: record.primaryColor,
    accentColor: record.accentColor,
    backgroundColor: record.backgroundColor,
    registrationButtonLabel: record.registrationButtonLabel,
    footerText: record.footerText,
  };
}
