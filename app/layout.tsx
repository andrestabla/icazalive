import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import HelpWidget from "@/app/components/help-widget";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Icaza Live — Gestión de eventos",
  description: "Plataforma para crear, transmitir y medir eventos digitales e híbridos.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supportEmail =
    process.env.SUPPORT_EMAIL ?? "soporte@icazalive.local";
  const supportHours =
    process.env.SUPPORT_HOURS ??
    "Lunes a viernes · 08:00–18:00 (hora de Miami)";

  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <HelpWidget
          supportEmail={supportEmail}
          supportHours={supportHours}
        />
      </body>
    </html>
  );
}
