import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import HelpWidget from "@/app/components/help-widget";
import FeedbackDialog from "@/app/components/feedback-dialog";
import { getBrandSettings } from "@/lib/brand";
import I18nRuntime from "@/lib/i18n/runtime";
import { resolveLocale } from "@/lib/i18n/server";
import { getSupportContact } from "@/lib/support";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// El favicon sale de la marca configurada (subido a S3) o del archivo por defecto.
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandSettings().catch(() => null);
  const icon = brand?.faviconUrl ?? "/favicon.svg";
  // Verificación de propiedad en Google Search Console (Safe Browsing, revisión).
  const verification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  return {
    title: `${brand?.organizationName ?? "Icaza Jammoul Live"} — Gestión de eventos`,
    description: "Plataforma para crear, transmitir y medir eventos digitales e híbridos.",
    icons: { icon, shortcut: icon, apple: icon },
    ...(verification ? { verification: { google: verification } } : {}),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const brand = await getBrandSettings().catch(() => null);
  const locale = await resolveLocale();
  const loaderStyle = brand?.loaderUrl
    ? ({ "--brand-loader-url": `url("${brand.loaderUrl}")` } as React.CSSProperties)
    : undefined;
  // Contacto de soporte: los agentes designados en Equipo (o el buzón por defecto).
  const supportContact = await getSupportContact();
  const supportEmail = supportContact.email;
  const supportHours = supportContact.hours;

  return (
    <html lang={locale} data-locale={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable}`} style={loaderStyle}>
        {locale !== "es" && (
          // Evita que la interfaz se vea un instante en español antes de traducirse.
          <style>{`html[data-locale="en"]:not(.i18n-ready) body > *:not(script) { visibility: hidden; }`}</style>
        )}
        <I18nRuntime locale={locale} />
        {children}
        <HelpWidget
          supportEmail={supportEmail}
          supportHours={supportHours}
        />
        <FeedbackDialog />
      </body>
    </html>
  );
}
