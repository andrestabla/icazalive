import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { eventOrganizers, users } from "@/db/schema";

// Enlace de agendamiento (Calendly u otro) que aparece como botón en el
// correo de seguimiento posterior. Cada organizador guarda el suyo en su
// perfil; el evento usa el del propietario y, si no tiene, el de cualquier
// coorganizador. El marcador {{schedule_link}} se resuelve al enviar, así
// que un enlace guardado después también llega a los seguimientos ya
// programados.

export const SCHEDULE_LINK_TAG = "{{schedule_link}}";
export const DEFAULT_SCHEDULE_LABEL = "Agendar una reunión con nuestro equipo";

export function normalizeSchedulingUrl(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 300) return "invalid";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "invalid";
    return url.toString();
  } catch {
    return "invalid";
  }
}

export async function resolveEventSchedulingUrl(
  eventId: string,
): Promise<{ url: string | null; ownerName: string | null }> {
  const db = getDb();
  const rows = await db
    .select({ role: eventOrganizers.role, name: users.name, url: users.schedulingUrl })
    .from(eventOrganizers)
    .innerJoin(users, eq(users.id, eventOrganizers.userId))
    .where(and(eq(eventOrganizers.eventId, eventId), eq(users.active, true)));
  const owner = rows.find((row) => row.role === "owner");
  if (owner?.url) return { url: owner.url, ownerName: owner.name };
  const fallback = rows.find((row) => Boolean(row.url));
  if (fallback?.url) return { url: fallback.url, ownerName: fallback.name };
  return { url: null, ownerName: owner?.name ?? null };
}

// Sustituye el marcador en el cuerpo. Sin enlace, se retiran las líneas que
// lo contenían para no dejar un botón vacío.
export function applySchedulingLink(body: string, url: string | null): string {
  if (!body.includes(SCHEDULE_LINK_TAG)) return body;
  if (url) return body.replaceAll(SCHEDULE_LINK_TAG, url);
  return body
    .split("\n")
    .filter((line) => !line.includes(SCHEDULE_LINK_TAG))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
