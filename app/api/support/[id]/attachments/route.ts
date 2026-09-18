import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportRequests } from "@/db/schema";
import { requireApiPermission } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { storeSupportAttachments } from "@/lib/support-attachments";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

// Evidencias adjuntadas por el equipo de soporte.
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("support.manage");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const [ticket] = await getDb().select({ id: supportRequests.id }).from(supportRequests).where(eq(supportRequests.id, id)).limit(1);
  if (!ticket) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No se recibió el archivo." }, { status: 400 });
  const result = await storeSupportAttachments(form, id, { userId: auth.user.id, name: auth.user.name, role: "agent" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  await getDb().update(supportRequests).set({ updatedAt: new Date() }).where(eq(supportRequests.id, id));
  await writeAuditLog({ actor: auth.user, action: "support.attachment.added", resourceType: "support_request", resourceId: id, summary: `${result.files.length} evidencia(s) añadida(s) al caso ${id.slice(0, 8)}.`, request });
  return NextResponse.json({ data: result.files }, { status: 201 });
}
