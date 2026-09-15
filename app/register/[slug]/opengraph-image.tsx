import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { getBrandSettings } from "@/lib/brand";
import { applyEventBrand } from "@/lib/brand-config";
import { absoluteFileUrl } from "@/lib/uploads";

// Miniatura del evento para WhatsApp, LinkedIn, X y demás redes cuando se
// comparte el enlace de registro. Usa los colores del evento y, si existe, la
// imagen de fondo de la página de registro.
export const runtime = "nodejs";
export const alt = "Registro al evento";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function formatDate(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} de ${part("month")} de ${part("year")} · ${part("hour")}:${part("minute")} ${part("dayPeriod")}`;
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [[event], brand] = await Promise.all([
    getDb().select().from(events).where(eq(events.slug, slug)).limit(1),
    getBrandSettings(),
  ]);
  const colors = event ? applyEventBrand(brand, event) : brand;
  const background = event?.registrationBackground
    ? /^https?:\/\//i.test(event.registrationBackground)
      ? event.registrationBackground
      : absoluteFileUrl(event.registrationBackground)
    : null;
  const title = event?.title ?? brand.organizationName;
  const subtitle = event
    ? `${formatDate(event.startsAt, event.timezone)} · ${Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60000)} min`
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "#fff",
          fontFamily: "sans-serif",
          backgroundColor: colors.primaryColor,
          backgroundImage: background
            ? `linear-gradient(145deg, ${colors.primaryColor}D9, ${colors.accentColor}B3), url(${background})`
            : `linear-gradient(145deg, ${colors.primaryColor}, ${colors.accentColor})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 700, opacity: 0.92 }}>
          <div style={{ display: "flex", width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
            {brand.markText}
          </div>
          {brand.organizationName}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, fontWeight: 700, opacity: 0.8 }}>EVENTO EN VIVO · REGÍSTRATE</div>
          <div style={{ display: "flex", fontSize: title.length > 40 ? 56 : 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          {subtitle && <div style={{ display: "flex", fontSize: 30, opacity: 0.92 }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, opacity: 0.85 }}>
          <span>Acceso online · inscripción gratuita en un minuto</span>
          <span style={{ display: "flex", padding: "12px 22px", borderRadius: 12, background: "#fff", color: colors.primaryColor, fontWeight: 700 }}>Reservar mi lugar →</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
