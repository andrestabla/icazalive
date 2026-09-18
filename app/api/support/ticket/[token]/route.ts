import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportAttachments, supportMessages, users } from "@/db/schema";
import { findTicketByToken, getSupportContact } from "@/lib/support";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ token: string }> };

// Vista del solicitante: estado, conversación pública y evidencias.
export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const ticket = await findTicketByToken(decodeURIComponent(token));
  if (!ticket) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  const db = getDb();
  const [messages, attachments, assignee, contact] = await Promise.all([
    db.select().from(supportMessages).where(and(eq(supportMessages.requestId, ticket.id), eq(supportMessages.internal, false))).orderBy(asc(supportMessages.createdAt)),
    db.select().from(supportAttachments).where(eq(supportAttachments.requestId, ticket.id)).orderBy(asc(supportAttachments.createdAt)),
    ticket.assignedTo ? db.select({ name: users.name }).from(users).where(eq(users.id, ticket.assignedTo)).limit(1) : Promise.resolve([]),
    getSupportContact(),
  ]);
  const { accessToken: _t, ...safe } = ticket;
  void _t;
  return NextResponse.json(
    { data: { ...safe, assigneeName: assignee[0]?.name ?? null, messages, attachments, supportEmail: contact.email, supportHours: contact.hours } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
