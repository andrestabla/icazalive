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
