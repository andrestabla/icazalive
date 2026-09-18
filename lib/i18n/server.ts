import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from "./locale";

// Idioma efectivo de la petición: la preferencia guardada del usuario con
// sesión; si no hay sesión, la cookie que dejó su última elección.
export async function resolveLocale(): Promise<Locale> {
  try {
    const user = await getCurrentUser();
    if (user?.locale) return normalizeLocale(user.locale);
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    return cookie ? normalizeLocale(cookie) : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
