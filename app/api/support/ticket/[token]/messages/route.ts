import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportMessages, supportRequests, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getPublicOrigin } from "@/lib/public-origin";
import { findTicketByToken } from "@/lib/support";
import { notifySupportAgentsOfActivity } from "@/lib/support-notifications";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ token: string }> };

// Respuesta del solicitante desde su enlace de seguimiento.
export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const ticket = await findTicketByToken(decodeURIComponent(token));
  if (!ticket) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { body?: string };
  const text = typeof body.body === "string" ? body.body.trim().replace(/\r\n/g, "\n") : "";
  if (text.length < 2 || text.length > 5000) {
    return NextResponse.json({ error: "Escribe un mensaje de 2 a 5.000 caracteres." }, { status: 400 });
  }
  const db = getDb();
  const now = new Date();
  const [message] = await db
    .insert(supportMessages)
    .values({ requestId: ticket.id, authorUserId: ticket.requesterUserId, authorName: ticket.requesterName, authorRole: "requester", body: text, createdAt: now })
    .returning();
  await db
    .update(supportRequests)
    .set({ lastMessageAt: now, updatedAt: now, ...(ticket.status === "resolved" || ticket.status === "closed" ? { status: "in_progress" as const, resolvedAt: null } : {}) })
    .where(eq(supportRequests.id, ticket.id));
  await writeAuditLog({ actorEmail: ticket.requesterEmail, action: "support.requester.replied", resourceType: "support_request", resourceId: ticket.id, summary: `El solicitante respondió en el caso ${ticket.id.slice(0, 8)}.`, request });
  const origin = getPublicOrigin(request);
  const assigned = ticket.assignedTo ? await db.select({ email: users.email }).from(users).where(eq(users.id, ticket.assignedTo)).limit(1) : [];
  after(() => notifySupportAgentsOfActivity({ ticket, origin, agentEmails: assigned.map((row) => row.email), summary: "respondió" }));
  return NextResponse.json({ data: message }, { status: 201 });
}
