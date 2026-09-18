import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportAttachments, supportMessages, supportRequests, users } from "@/db/schema";
import { requireApiPermission } from "@/lib/api-guards";
import { getSupportAgents, SUPPORT_STATUSES, type SupportStatus } from "@/lib/support";

export const runtime = "nodejs";

// Casos de soporte para el módulo Soporte: filtros por estado, asignación y
// texto; cada caso trae su agente, contador de mensajes y de evidencias.
export async function GET(request: Request) {
  const auth = await requireApiPermission("support.view");
  if ("error" in auth) return auth.error;
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const assigned = params.get("assigned");
  const q = params.get("q")?.trim().slice(0, 80);

  const conditions = [];
  if (status && (SUPPORT_STATUSES as readonly string[]).includes(status)) conditions.push(eq(supportRequests.status, status as SupportStatus));
  if (assigned === "me") conditions.push(eq(supportRequests.assignedTo, auth.user.id));
  else if (assigned === "none") conditions.push(sql`${supportRequests.assignedTo} is null`);
  else if (assigned) conditions.push(eq(supportRequests.assignedTo, assigned));
  if (q) {
    const like = `%${q}%`;
    conditions.push(or(ilike(supportRequests.subject, like), ilike(supportRequests.requesterName, like), ilike(supportRequests.requesterEmail, like), ilike(supportRequests.description, like)));
  }

  const db = getDb();
  const rows = await db
    .select({
      id: supportRequests.id,
      subject: supportRequests.subject,
      category: supportRequests.category,
      status: supportRequests.status,
      requesterName: supportRequests.requesterName,
      requesterEmail: supportRequests.requesterEmail,
      eventTitle: supportRequests.eventTitle,
      assignedTo: supportRequests.assignedTo,
      assigneeName: users.name,
      createdAt: supportRequests.createdAt,
      updatedAt: supportRequests.updatedAt,
      lastMessageAt: supportRequests.lastMessageAt,
      resolvedAt: supportRequests.resolvedAt,
      messageCount: sql<number>`(select count(*)::int from ${supportMessages} where ${supportMessages.requestId} = ${supportRequests.id})`,
      attachmentCount: sql<number>`(select count(*)::int from ${supportAttachments} where ${supportAttachments.requestId} = ${supportRequests.id})`,
    })
    .from(supportRequests)
    .leftJoin(users, eq(supportRequests.assignedTo, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(supportRequests.updatedAt))
    .limit(300);

  const totals = await db
    .select({ status: supportRequests.status, total: sql<number>`count(*)::int` })
    .from(supportRequests)
    .groupBy(supportRequests.status);

  return NextResponse.json(
    { data: { tickets: rows, totals, agents: await getSupportAgents(), me: auth.user.id } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
