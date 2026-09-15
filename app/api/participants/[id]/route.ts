import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { registrations, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// Eliminación definitiva de un participante (solo administradores): borra sus
// inscripciones en todos los eventos (con sus accesos, correos en cola y
// respuestas del formulario, en cascada) y su cuenta de participante. Los
// registros de consentimiento se conservan sin vínculo, como exige la ley.
export async function DELETE(request: Request, context: RouteContext) {
  const currentUser = await requireApiUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (currentUser.role !== "administrator") {
    return NextResponse.json(
      { error: "Solo un administrador puede eliminar participantes." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  const db = getDb();
  const [participant] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!participant) {
    return NextResponse.json({ error: "Participante no encontrado." }, { status: 404 });
  }
  if (participant.role !== "participant") {
    return NextResponse.json(
      { error: "Esta cuenta pertenece al equipo; gestiónala desde Equipo." },
      { status: 409 },
    );
  }

  const [summary] = await db
    .select({ total: count() })
    .from(registrations)
    .where(and(eq(registrations.participantId, participant.id)));

  await db.delete(registrations).where(eq(registrations.participantId, participant.id));
  await db.delete(users).where(eq(users.id, participant.id));

  await writeAuditLog({
    actor: currentUser,
    action: "participant.deleted",
    resourceType: "participant",
    resourceId: participant.id,
    summary: `Participante “${participant.name}” (${participant.email}) eliminado con ${summary?.total ?? 0} inscripción(es).`,
    details: { registrations: summary?.total ?? 0 },
    request,
  });

  return NextResponse.json({ data: { deleted: true, registrations: summary?.total ?? 0 } });
}
