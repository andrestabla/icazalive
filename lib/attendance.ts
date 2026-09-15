import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { registrations } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";

// Estados automáticos de asistencia.
//
// - Al entrar a la sala con su enlace personal mientras el evento está EN
//   VIVO, el inscrito pasa a "Asistió" (y se guarda la hora de entrada).
// - Al completarse el evento, quienes seguían en "Registrado" o "Confirmado"
//   pasan a "No asistió".
// El organizador puede corregir cualquier estado a mano desde Participantes.

export async function markAttendance(registrationId: string): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .update(registrations)
    .set({ status: "attended", joinedAt: now })
    .where(
      and(
        eq(registrations.id, registrationId),
        inArray(registrations.status, ["registered", "confirmed"]),
      ),
    )
    .returning({ id: registrations.id });
  if (rows.length === 0) {
    // Ya estaba en "Asistió": solo se completa la hora de entrada si faltaba.
    await db
      .update(registrations)
      .set({ joinedAt: now })
      .where(and(eq(registrations.id, registrationId), eq(registrations.status, "attended"), isNull(registrations.joinedAt)));
    return false;
  }
  return true;
}

export async function closeAttendance(eventId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .update(registrations)
    .set({ status: "absent" })
    .where(
      and(
        eq(registrations.eventId, eventId),
        inArray(registrations.status, ["registered", "confirmed"]),
      ),
    )
    .returning({ id: registrations.id });
  if (rows.length) {
    await writeAuditLog({
      action: "registrations.attendance.closed",
      resourceType: "event",
      resourceId: eventId,
      summary: `${rows.length} inscrito(s) sin entrada a la sala marcados como “No asistió” al completarse el evento.`,
      details: { absent: rows.length },
    });
  }
  return rows.length;
}
