import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportRequests, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getPublicOrigin } from "@/lib/public-origin";
import { findTicketByToken } from "@/lib/support";
import { storeSupportAttachments } from "@/lib/support-attachments";
import { notifySupportAgentsOfActivity } from "@/lib/support-notifications";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ token: string }> };

// Evidencias adjuntadas por el solicitante desde su enlace de seguimiento.
export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const ticket = await findTicketByToken(decodeURIComponent(token));
  if (!ticket) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No se recibió el archivo." }, { status: 400 });
  const result = await storeSupportAttachments(form, ticket.id, { userId: ticket.requesterUserId, name: ticket.requesterName, role: "requester" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const db = getDb();
  await db.update(supportRequests).set({ updatedAt: new Date() }).where(eq(supportRequests.id, ticket.id));
  await writeAuditLog({ actorEmail: ticket.requesterEmail, action: "support.attachment.added", resourceType: "support_request", resourceId: ticket.id, summary: `${result.files.length} evidencia(s) del solicitante en el caso ${ticket.id.slice(0, 8)}.`, request });
  const origin = getPublicOrigin(request);
  const assigned = ticket.assignedTo ? await db.select({ email: users.email }).from(users).where(eq(users.id, ticket.assignedTo)).limit(1) : [];
  after(() => notifySupportAgentsOfActivity({ ticket, origin, agentEmails: assigned.map((row) => row.email), summary: `adjuntó ${result.files.length} evidencia(s)` }));
  return NextResponse.json({ data: result.files }, { status: 201 });
}
