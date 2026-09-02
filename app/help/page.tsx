import { getCurrentUser } from "@/lib/auth";
import { getBrandSettings } from "@/lib/brand";
import type { HelpLocale } from "@/lib/help-content";
import HelpCenterClient from "./help-center-client";

export const dynamic = "force-dynamic";

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{
    contact?: string;
    article?: string;
    lang?: string;
  }>;
}) {
  const [viewer, brand, parameters] = await Promise.all([
    getCurrentUser(),
    getBrandSettings(),
    searchParams,
  ]);
  const locale: HelpLocale =
    parameters.lang === "en" || parameters.lang === "fr"
      ? parameters.lang
      : "es";

  return (
    <HelpCenterClient
      brand={brand}
      viewer={viewer}
      initialLocale={locale}
      initialArticle={parameters.article ?? null}
      initialContactOpen={parameters.contact === "1"}
      supportEmail={process.env.SUPPORT_EMAIL ?? "soporte@icazalive.local"}
      salesEmail={process.env.SALES_EMAIL ?? "ventas@icazalive.local"}
      supportHours={
        process.env.SUPPORT_HOURS ??
        "Lunes a viernes · 08:00–18:00 (hora de Miami)"
      }
    />
  );
}
