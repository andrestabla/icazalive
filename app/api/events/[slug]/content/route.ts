import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { contentAssets, events } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { canManageEvent } from "@/lib/event-permissions";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ slug: string }> };

async function resolveManaged(slug: string) {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (user.role === "participant") {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }
  const [event] = await getDb()
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return { error: NextResponse.json({ error: "Evento no encontrado." }, { status: 404 }) };
  }
  if (!(await canManageEvent(user, event.id))) {
    return {
      error: NextResponse.json({ error: "No eres organizador de este evento." }, { status: 403 }),
    };
  }
  return { user, event };
}

// Configuración del contenido simulado del evento: qué video de la biblioteca
// se usa, cómo se distribuye (S3 directo o S3→IVS) y, para híbridos, en qué
// minuto la señal en vivo cede el paso al contenido simulado.
export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveManaged(slug);
  if ("error" in resolved) return resolved.error;
  const { user, event } = resolved;

  const body = (await request.json().catch(() => ({}))) as {
    contentAssetId?: string | null;
    simulatedDelivery?: "direct" | "streaming";
    hybridSwitchOffsetMinutes?: number | null;
  };

  // La entrega del contenido simulado es siempre vía Amazon IVS (streaming).
  body.simulatedDelivery = "streaming";

  let contentAssetId: string | null | undefined;
  if (body.contentAssetId !== undefined) {
    if (body.contentAssetId === null) {
      contentAssetId = null;
    } else {
      const [asset] = await getDb()
        .select({ id: contentAssets.id })
        .from(contentAssets)
        .where(eq(contentAssets.id, body.contentAssetId))
        .limit(1);
      if (!asset) {
        return NextResponse.json(
          { error: "El contenido seleccionado no existe en la biblioteca." },
          { status: 404 },
        );
      }
      contentAssetId = asset.id;
    }
  }

  let hybridOffset: number | null | undefined;
  if (body.hybridSwitchOffsetMinutes !== undefined) {
    if (body.hybridSwitchOffsetMinutes === null) {
      hybridOffset = null;
    } else if (
      Number.isFinite(body.hybridSwitchOffsetMinutes) &&
      body.hybridSwitchOffsetMinutes >= 0 &&
      body.hybridSwitchOffsetMinutes < 24 * 60
    ) {
      hybridOffset = Math.round(body.hybridSwitchOffsetMinutes);
    } else {
      return NextResponse.json(
        { error: "El minuto de transición híbrida no es válido." },
        { status: 400 },
      );
    }
  }

  const [updated] = await getDb()
    .update(events)
    .set({
      ...(contentAssetId !== undefined ? { contentAssetId } : {}),
      simulatedDelivery: "streaming" as const,
      ...(hybridOffset !== undefined
        ? { hybridSwitchOffsetMinutes: hybridOffset }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id))
    .returning();

  await writeAuditLog({
    actor: user,
    action: "event.content_configured",
    resourceType: "event",
    resourceId: event.id,
    summary: `Contenido simulado configurado para “${event.title}”.`,
    details: {
      contentAssetId: updated.contentAssetId,
      simulatedDelivery: updated.simulatedDelivery,
      hybridSwitchOffsetMinutes: updated.hybridSwitchOffsetMinutes,
    },
    request,
  });
  return NextResponse.json({
    data: {
      contentAssetId: updated.contentAssetId,
      simulatedDelivery: updated.simulatedDelivery,
      hybridSwitchOffsetMinutes: updated.hybridSwitchOffsetMinutes,
    },
  });
}
