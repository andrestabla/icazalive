// Idiomas de la interfaz. El español es el idioma de origen de la plataforma;
// el inglés se aplica sobre la interfaz ya renderizada (ver runtime.tsx).
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "icaza_locale";
export const LOCALE_LABELS: Record<Locale, string> = { es: "Español", en: "English" };

export function normalizeLocale(value: unknown): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}
