import { asc, eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportAttachments, supportMessages, supportRequests, users } from "@/db/schema";
import { requireApiPermission } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { getPublicOrigin } from "@/lib/public-origin";
import { getSupportAgents, SUPPORT_STATUS_LABELS, SUPPORT_STATUSES, type SupportStatus } from "@/lib/support";
import { notifySupportRequesterUpdate } from "@/lib/support-notifications";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

async function loadTicket(id: string) {
  const db = getDb();
  const [ticket] = await db
    .select({
      ticket: supportRequests,
      assigneeName: users.name,
      assigneeEmail: users.email,
    })
    .from(supportRequests)
    .leftJoin(users, eq(supportRequests.assignedTo, users.id))
    .where(eq(supportRequests.id, id))
    .limit(1);
  if (!ticket) return null;
  const [messages, attachments] = await Promise.all([
    db.select().from(supportMessages).where(eq(supportMessages.requestId, id)).orderBy(asc(supportMessages.createdAt)),
    db.select().from(supportAttachments).where(eq(supportAttachments.requestId, id)).orderBy(asc(supportAttachments.createdAt)),
  ]);
  const { accessToken: _token, ...safe } = ticket.ticket;
  void _token;
  return { ...safe, assigneeName: ticket.assigneeName, assigneeEmail: ticket.assigneeEmail, messages, attachments };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("support.view");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const data = await loadTicket(id);
  if (!data) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  return NextResponse.json({ data: { ...data, agents: await getSupportAgents() } }, { headers: { "Cache-Control": "no-store" } });
}

// Estado y asignación: solo quien gestiona soporte.
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("support.manage");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { status?: string; assignedTo?: string | null };
  const db = getDb();
  const [target] = await db.select().from(supportRequests).where(eq(supportRequests.id, id)).limit(1);
  if (!target) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });

  const changes: Partial<typeof supportRequests.$inferInsert> = { updatedAt: new Date() };
  if (body.status !== undefined) {
    if (!(SUPPORT_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
    }
    changes.status = body.status as SupportStatus;
    changes.resolvedAt = body.status === "resolved" || body.status === "closed" ? new Date() : null;
  }
  if (body.assignedTo !== undefined) {
    if (body.assignedTo === null || body.assignedTo === "") {
      changes.assignedTo = null;
    } else {
      const agents = await getSupportAgents();
      const agent = agents.find((item) => item.id === body.assignedTo);
      if (!agent && body.assignedTo !== auth.user.id) {
        return NextResponse.json({ error: "Solo se puede asignar a un miembro marcado como soporte." }, { status: 400 });
      }
      changes.assignedTo = body.assignedTo;
    }
  }
  const [updated] = await db.update(supportRequests).set(changes).where(eq(supportRequests.id, id)).returning();
  await writeAuditLog({
    actor: auth.user,
    action: "support.request.updated",
    resourceType: "support_request",
    resourceId: id,
    summary: `Caso ${id.slice(0, 8)} actualizado: ${changes.status ? `estado ${SUPPORT_STATUS_LABELS[changes.status as SupportStatus]}` : ""}${changes.assignedTo !== undefined ? ` asignación ${changes.assignedTo ?? "sin asignar"}` : ""}`.trim(),
    details: { previousStatus: target.status, status: updated.status, previousAssignedTo: target.assignedTo, assignedTo: updated.assignedTo },
    request,
  });
  if (changes.status && changes.status !== target.status) {
    const origin = getPublicOrigin(request);
    after(() =>
      notifySupportRequesterUpdate({
        ticket: updated,
        token: updated.accessToken,
        origin,
        kind: "status",
        actorName: auth.user.name,
      }),
    );
  }
  const data = await loadTicket(id);
  return NextResponse.json({ data });
}
