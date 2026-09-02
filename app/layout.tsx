import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import HelpWidget from "@/app/components/help-widget";
import { getBrandSettings } from "@/lib/brand";
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
  const loaderStyle = brand?.loaderUrl
    ? ({ "--brand-loader-url": `url("${brand.loaderUrl}")` } as React.CSSProperties)
    : undefined;
  const supportEmail =
    process.env.SUPPORT_EMAIL ?? "soporte@icazalive.local";
  const supportHours =
    process.env.SUPPORT_HOURS ??
    "Lunes a viernes · 08:00–18:00 (hora de Miami)";

  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`} style={loaderStyle}>
        {children}
        <HelpWidget
          supportEmail={supportEmail}
          supportHours={supportHours}
        />
      </body>
    </html>
  );
}
