import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { eventOrganizers } from "@/db/schema";
import type { AuthenticatedUser } from "@/lib/auth";

// Los administradores gestionan cualquier evento. Los organizadores solo
// los eventos donde figuran como propietario o coorganizador.
export async function canManageEvent(
  user: AuthenticatedUser,
  eventId: string,
): Promise<boolean> {
  if (user.role === "administrator") return true;
  if (user.role !== "organizer") return false;

  const [membership] = await getDb()
    .select({ id: eventOrganizers.id })
    .from(eventOrganizers)
    .where(
      and(
        eq(eventOrganizers.eventId, eventId),
        eq(eventOrganizers.userId, user.id),
      ),
    )
    .limit(1);
  return Boolean(membership);
}

export async function isEventOwner(
  user: AuthenticatedUser,
  eventId: string,
): Promise<boolean> {
  if (user.role === "administrator") return true;
  const [membership] = await getDb()
    .select({ id: eventOrganizers.id })
    .from(eventOrganizers)
    .where(
      and(
        eq(eventOrganizers.eventId, eventId),
        eq(eventOrganizers.userId, user.id),
        eq(eventOrganizers.role, "owner"),
      ),
    )
    .limit(1);
  return Boolean(membership);
}
