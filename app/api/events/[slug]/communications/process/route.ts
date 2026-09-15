import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { processDueDeliveries, requeueFailedDeliveries } from "@/lib/communication-worker";
import { activeProviderName } from "@/lib/email-provider";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role === "participant") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const { slug } = await context.params;
  const [event] = await getDb()
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  // { retryFailed: true } vuelve a encolar las entregas con error antes de
  // procesar, para reenviarlas una vez corregida la causa (p. ej. proveedor).
  const body = (await request.json().catch(() => ({}))) as { retryFailed?: boolean };
  const requeued = body.retryFailed === true ? await requeueFailedDeliveries(event.id) : 0;
  const summary = await processDueDeliveries(event.id);
  return NextResponse.json({
    data: { ...summary, requeued, provider: activeProviderName() },
  });
}
