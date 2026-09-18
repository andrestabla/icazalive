import { randomBytes } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { supportRequests, users } from "@/db/schema";

// Estados de un caso de soporte, en el orden del flujo de atención. El agente
// encargado es quien los cambia.
export const SUPPORT_STATUSES = ["new", "in_progress", "resolved", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  new: "Abierto",
  in_progress: "En gestión",
  resolved: "Solucionado",
  closed: "Sin solución",
};
export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  technical: "Técnico",
  event: "Evento",
  account: "Cuenta y acceso",
  integration: "Integraciones",
  billing: "Facturación",
  privacy: "Privacidad y datos",
  other: "Otro",
};

export type SupportAgent = { id: string; name: string; email: string };

// Miembros del equipo marcados como soporte en Equipo.
export async function getSupportAgents(): Promise<SupportAgent[]> {
  return getDb()
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.supportAgent, true), eq(users.active, true), ne(users.role, "participant")))
    .orderBy(asc(users.createdAt));
}

// Contacto de soporte que se muestra en el Centro de ayuda y en los correos:
// los agentes de soporte designados; si no hay ninguno, la variable del
// servidor o el buzón por defecto.
export async function getSupportContact(): Promise<{ email: string; emails: string[]; hours: string }> {
  const fallback = process.env.SUPPORT_EMAIL ?? "soporte@icazalive.local";
  const hours = process.env.SUPPORT_HOURS ?? "Lunes a viernes · 08:00–18:00 (hora de Miami)";
  try {
    const agents = await getSupportAgents();
    const emails = agents.map((agent) => agent.email);
    return { email: emails.length ? emails.join(", ") : fallback, emails: emails.length ? emails : [fallback], hours };
  } catch {
    return { email: fallback, emails: [fallback], hours };
  }
}

// Token del solicitante para seguir su caso sin iniciar sesión; viaja en el
// enlace de cada correo del caso.
export function createSupportToken() {
  return randomBytes(24).toString("base64url");
}
export function supportTicketPath(token: string) {
  return `/support/ticket/${encodeURIComponent(token)}`;
}
export function supportTicketNumber(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export async function findTicketByToken(token: string) {
  if (!token || token.length < 16 || token.length > 128) return null;
  const [ticket] = await getDb()
    .select()
    .from(supportRequests)
    .where(eq(supportRequests.accessToken, token))
    .limit(1);
  return ticket ?? null;
}
