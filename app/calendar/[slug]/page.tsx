import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { getBrandSettings } from "@/lib/brand";
import { getPublicOriginFromEnv } from "@/lib/public-origin";
import { resolveRegistrationAccess } from "@/lib/registration-access";
import "../calendar.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Añadir al calendario", robots: { index: false } };

// Página intermedia del botón "Añadir al calendario" de los correos: ofrece
// el evento ya cargado para Google Calendar, Outlook (personal y empresarial),
// Yahoo y el archivo .ics para Apple Calendar u Outlook de escritorio.

function compact(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export default async function AddToCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { slug } = await params;
  const { access } = await searchParams;
  const [[event], brand] = await Promise.all([
    getDb()
      .select({
        title: events.title,
        slug: events.slug,
        description: events.description,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        timezone: events.timezone,
        format: events.format,
        brandPrimaryColor: events.brandPrimaryColor,
        brandAccentColor: events.brandAccentColor,
      })
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1),
    getBrandSettings(),
  ]);
  if (!event) notFound();

  const token = access?.trim() ?? "";
  const valid = token ? await resolveRegistrationAccess(token, slug, { includeCancelled: true }) : null;
  const origin = getPublicOriginFromEnv();
  const encoded = encodeURIComponent(token);
  const roomUrl = `${origin}/room/${event.slug}?access=${encoded}`;
  const location = event.format === "hybrid" ? "Evento híbrido · acceso online" : "Evento online";
  const details = `${event.description?.trim() || `Evento de ${brand.organizationName}`}\n\nEntrar al evento: ${roomUrl}`;
  const when = new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short", timeZone: event.timezone }).format(event.startsAt);

  const google = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${compact(event.startsAt)}/${compact(event.endsAt)}`,
    details,
    location,
    ctz: event.timezone,
  })}`;
  const outlookParams = new URLSearchParams({
    rru: "addevent",
    subject: event.title,
    startdt: event.startsAt.toISOString(),
    enddt: event.endsAt.toISOString(),
    body: details,
    location,
  });
  const outlook = `https://outlook.live.com/calendar/0/action/compose?${outlookParams}`;
  const office = `https://outlook.office.com/calendar/0/action/compose?${outlookParams}`;
  const yahoo = `https://calendar.yahoo.com/?${new URLSearchParams({
    v: "60",
    title: event.title,
    st: compact(event.startsAt),
    et: compact(event.endsAt),
    desc: details,
    in_loc: location,
  })}`;
  const ics = `/api/public/events/${event.slug}/calendar?access=${encoded}`;
  const primary = event.brandPrimaryColor || brand.primaryColor;
  const accent = event.brandAccentColor || brand.accentColor;

  return (
    <main className="calendar-page" style={{ ["--cal-primary" as string]: primary, ["--cal-accent" as string]: accent }}>
      <section className="calendar-card">
        <p className="eyebrow">AÑADIR AL CALENDARIO</p>
        <h1>{event.title}</h1>
        <p className="calendar-when">{when} · hora de {event.timezone.split("/").pop()?.replace("_", " ")}</p>
        {valid ? (
          <>
            <p className="calendar-hint">Elige tu calendario. El evento se abre ya cargado con la fecha, la hora y tu enlace personal de acceso.</p>
            <div className="calendar-options">
              <a href={google} target="_blank" rel="noopener noreferrer"><span>G</span>Google Calendar</a>
              <a href={outlook} target="_blank" rel="noopener noreferrer"><span>O</span>Outlook.com / Hotmail</a>
              <a href={office} target="_blank" rel="noopener noreferrer"><span>M</span>Outlook empresarial (Microsoft 365)</a>
              <a href={yahoo} target="_blank" rel="noopener noreferrer"><span>Y</span>Yahoo Calendar</a>
              <a href={ics} download={`${event.slug}.ics`}><span>⤓</span>Apple Calendar, Outlook de escritorio u otro (.ics)</a>
            </div>
            <a className="calendar-room" href={roomUrl}>Ir a la sala del evento →</a>
          </>
        ) : (
          <p className="calendar-hint">Este enlace de calendario no es válido o ya expiró. Abre el correo de confirmación más reciente o vuelve a inscribirte.</p>
        )}
        <footer>Powered by {brand.organizationName}</footer>
      </section>
    </main>
  );
}
