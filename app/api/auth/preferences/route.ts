import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { normalizeSchedulingUrl } from "@/lib/scheduling-link";

export const runtime = "nodejs";

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("es-CO", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as { timezone?: string | null; schedulingUrl?: string | null };
  if (body.timezone === undefined && body.schedulingUrl === undefined) {
    return NextResponse.json(
      { error: "No hay preferencias para actualizar." },
      { status: 400 },
    );
  }

  // Enlace de agendamiento (Calendly u otro) del organizador.
  if (body.schedulingUrl !== undefined) {
    const schedulingUrl = normalizeSchedulingUrl(body.schedulingUrl);
    if (schedulingUrl === "invalid") {
      return NextResponse.json(
        { error: "El enlace de agendamiento debe ser una URL https válida (por ejemplo, https://calendly.com/tu-usuario/entrevista)." },
        { status: 400 },
      );
    }
    await getDb()
      .update(users)
      .set({ schedulingUrl, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await writeAuditLog({
      actor: user,
      action: "auth.preferences.updated",
      resourceType: "authentication",
      resourceId: user.id,
      summary: schedulingUrl ? "Enlace de agendamiento actualizado." : "Enlace de agendamiento retirado.",
      details: { schedulingUrl: schedulingUrl ?? "" },
      request,
    });
    if (body.timezone === undefined) {
      return NextResponse.json({ data: { schedulingUrl } });
    }
  }
  if (
    body.timezone !== null &&
    (typeof body.timezone !== "string" ||
      body.timezone.length > 64 ||
      !isValidTimezone(body.timezone))
  ) {
    return NextResponse.json(
      { error: "La zona horaria no es válida." },
      { status: 400 },
    );
  }

  await getDb()
    .update(users)
    .set({ timezone: body.timezone, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await writeAuditLog({
    actor: user,
    action: "auth.preferences.updated",
    resourceType: "authentication",
    resourceId: user.id,
    summary: "Preferencias de cuenta actualizadas.",
    details: { timezone: body.timezone },
    request,
  });
  return NextResponse.json({ data: { timezone: body.timezone } });
}
