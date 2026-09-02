export function createParticipantUrls({
  origin,
  eventSlug,
  accessToken,
}: {
  origin: string;
  eventSlug: string;
  accessToken: string;
}) {
  const token = encodeURIComponent(accessToken);
  return {
    accessUrl: `${origin}/room/${eventSlug}?access=${token}`,
    manageUrl: `${origin}/manage-registration/${eventSlug}?access=${token}`,
    calendarUrl: `${origin}/api/public/events/${eventSlug}/calendar?access=${token}`,
  };
}

function formatEventDate(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts
      .find((item) => item.type === type)
      ?.value.replace(/\s+/g, " ") ?? "";
  return `${part("day")} de ${part("month")} de ${part("year")} · ${part("hour")}:${part("minute")} ${part("dayPeriod")}`.trim();
}

export function renderParticipantCommunication({
  template,
  participantName,
  eventTitle,
  eventSlug,
  startsAt,
  timezone,
  origin,
  accessToken,
  includeManagementFooter = false,
}: {
  template: string;
  participantName: string;
  eventTitle: string;
  eventSlug: string;
  startsAt: Date;
  timezone: string;
  origin: string;
  accessToken: string;
  includeManagementFooter?: boolean;
}) {
  const urls = createParticipantUrls({ origin, eventSlug, accessToken });
  let rendered = template
    .replaceAll("{{participant_name}}", participantName)
    .replaceAll("{{event_title}}", eventTitle)
    .replaceAll("{{event_date}}", formatEventDate(startsAt, timezone))
    .replaceAll("{{access_link}}", urls.accessUrl)
    .replaceAll("{{manage_link}}", urls.manageUrl)
    .replaceAll("{{calendar_link}}", urls.calendarUrl);

  // Etiqueta unificada del botón de acceso (también en plantillas antiguas).
  rendered = rendered.replace(/Enlace de acceso:\s*/g, "Entrar al evento: ");

  if (
    includeManagementFooter &&
    !template.includes("{{calendar_link}}") &&
    !rendered.includes(urls.calendarUrl)
  ) {
    rendered += `\n\nAgendar en mi calendario: ${urls.calendarUrl}`;
  }
  if (
    includeManagementFooter &&
    !template.includes("{{manage_link}}") &&
    !rendered.includes(urls.manageUrl)
  ) {
    rendered += `\nActualizar mi inscripción: ${urls.manageUrl}`;
  }
  return { body: rendered, ...urls };
}
