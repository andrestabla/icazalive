import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  getBearerToken,
  resolveRegistrationAccess,
} from "@/lib/registration-access";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

function icsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function foldIcsLine(line: string) {
  const folded: string[] = [];
  let remaining = line;
  while (remaining.length > 70) {
    folded.push(remaining.slice(0, 70));
    remaining = ` ${remaining.slice(70)}`;
  }
  folded.push(remaining);
  return folded;
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const token = getBearerToken(request) || url.searchParams.get("access") || "";
  const access = await resolveRegistrationAccess(token, slug);
  if (!access) {
    return Response.json(
      { error: "El enlace de calendario no es válido o ya expiró." },
      { status: 401 },
    );
  }
  const [event] = await getDb()
    .select()
    .from(events)
    .where(eq(events.id, access.eventId))
    .limit(1);
  if (!event) {
    return Response.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const encodedToken = encodeURIComponent(token);
  const roomUrl = `${url.origin}/room/${event.slug}?access=${encodedToken}`;
  const manageUrl = `${url.origin}/manage-registration/${event.slug}?access=${encodedToken}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Icaza Jammoul Live//Eventos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${access.registrationId}@icaza-live.local`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(`${event.description ?? "Evento de Icaza Jammoul Live"}\n\nAcceso: ${roomUrl}\nGestionar inscripción: ${manageUrl}`)}`,
    `URL:${roomUrl}`,
    `LOCATION:${icsText(event.format === "hybrid" ? "Evento híbrido · acceso online" : "Evento online")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  await writeAuditLog({
    actorEmail: access.participantEmail,
    action: "registration.calendar.downloaded",
    resourceType: "registration",
    resourceId: access.registrationId,
    summary: `Invitación de calendario descargada para “${event.title}”.`,
    details: { eventId: event.id },
    request,
  });

  return new Response(lines.flatMap(foldIcsLine).join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${event.slug}.ics"`,
      "cache-control": "private, no-store",
    },
  });
}
