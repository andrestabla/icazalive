import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportMessages, supportRequests } from "@/db/schema";
import { requireApiPermission } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { getPublicOrigin } from "@/lib/public-origin";
import { notifySupportRequesterUpdate } from "@/lib/support-notifications";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

// Respuesta del agente (llega al solicitante por correo) o nota interna.
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("support.manage");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { body?: string; internal?: boolean };
  const text = typeof body.body === "string" ? body.body.trim().replace(/\r\n/g, "\n") : "";
  if (text.length < 2 || text.length > 5000) {
    return NextResponse.json({ error: "Escribe un mensaje de 2 a 5.000 caracteres." }, { status: 400 });
  }
  const db = getDb();
  const [ticket] = await db.select().from(supportRequests).where(eq(supportRequests.id, id)).limit(1);
  if (!ticket) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  const internal = body.internal === true;
  const now = new Date();
  const [message] = await db
    .insert(supportMessages)
    .values({ requestId: id, authorUserId: auth.user.id, authorName: auth.user.name, authorRole: "agent", body: text, internal, createdAt: now })
    .returning();
  await db
    .update(supportRequests)
    .set({
      lastMessageAt: now,
      updatedAt: now,
      // Al responder un caso abierto pasa a En gestión automáticamente.
      ...(!internal && ticket.status === "new" ? { status: "in_progress" as const } : {}),
      ...(!ticket.assignedTo ? { assignedTo: auth.user.id } : {}),
    })
    .where(eq(supportRequests.id, id));
  await writeAuditLog({
    actor: auth.user,
    action: internal ? "support.note.created" : "support.reply.sent",
    resourceType: "support_request",
    resourceId: id,
    summary: internal ? `Nota interna en el caso ${id.slice(0, 8)}.` : `Respuesta enviada en el caso ${id.slice(0, 8)}.`,
    request,
  });
  if (!internal) {
    const origin = getPublicOrigin(request);
    after(() => notifySupportRequesterUpdate({ ticket, token: ticket.accessToken, origin, kind: "reply", message: text, actorName: auth.user.name }));
  }
  return NextResponse.json({ data: message }, { status: 201 });
}
