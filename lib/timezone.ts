// Zona horaria de toda la plataforma: Miami (America/New_York). Cambia sola
// entre EST (UTC-5) y EDT (UTC-4) según el horario de verano. Se puede
// sobrescribir en el build con NEXT_PUBLIC_PLATFORM_TIMEZONE.
export const PLATFORM_TIMEZONE =
  process.env.NEXT_PUBLIC_PLATFORM_TIMEZONE?.trim() || "America/New_York";

export const PLATFORM_TIMEZONE_LABEL = "hora de Miami";

export function formatPlatformDateTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  timeZone: string = PLATFORM_TIMEZONE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-CO", { ...options, timeZone }).format(date);
}

// ---- Entradas datetime-local en la zona de la plataforma -------------------
// Un <input type="datetime-local"> entrega "YYYY-MM-DDTHH:mm" sin zona. La
// plataforma opera en hora de Miami, así que ese valor se interpreta en
// PLATFORM_TIMEZONE (y no en la zona del navegador de quien lo escribe).

function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

// "2026-09-10T10:00" (hora de Miami) -> Date (instante UTC). Devuelve una
// fecha inválida si el texto no tiene el formato esperado.
export function platformLocalToDate(value: string, timeZone: string = PLATFORM_TIMEZONE): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return new Date(NaN);
  const [, y, mo, d, h, mi, s] = match.map(Number) as number[];
  const guess = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  // Dos pasadas para acertar el offset en cambios de horario de verano.
  let offset = zoneOffsetMinutes(new Date(guess), timeZone);
  let instant = guess - offset * 60_000;
  offset = zoneOffsetMinutes(new Date(instant), timeZone);
  instant = guess - offset * 60_000;
  return new Date(instant);
}

// Date -> "YYYY-MM-DDTHH:mm" en hora de la plataforma, para defaultValue/min/max.
export function toPlatformDateTimeInput(value: Date | string | number, timeZone: string = PLATFORM_TIMEZONE): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
