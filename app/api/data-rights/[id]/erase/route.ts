import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  auditLogs,
  dataSubjectRequests,
  eventChatMessages,
  eventQuestions,
  registrations,
  supportRequests,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const administrator = await requireApiUser();
  if (!administrator) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (administrator.role !== "administrator") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { confirmation?: string };
  const db = getDb();
  const [dataRequest] = await db
    .select()
    .from(dataSubjectRequests)
    .where(eq(dataSubjectRequests.id, id))
    .limit(1);
  if (!dataRequest) {
    return NextResponse.json(
      { error: "Solicitud no encontrada." },
      { status: 404 },
    );
  }
  if (dataRequest.type !== "deletion" || !dataRequest.identityVerified) {
    return NextResponse.json(
      {
        error:
          "La eliminación requiere una solicitud de supresión con identidad verificada.",
      },
      { status: 409 },
    );
  }
  if (
    typeof body.confirmation !== "string" ||
    body.confirmation.trim().toLowerCase() !== dataRequest.requesterEmail
  ) {
    return NextResponse.json(
      { error: "Escribe el correo exacto para confirmar la eliminación." },
      { status: 400 },
    );
  }

  const [subject] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, dataRequest.requesterEmail))
    .limit(1);
  if (subject && subject.role !== "participant") {
    return NextResponse.json(
      {
        error:
          "Las cuentas administrativas requieren una revisión manual de obligaciones y propiedad antes de eliminarse.",
      },
      { status: 409 },
    );
  }

  const redactedId = createHash("sha256")
    .update(dataRequest.requesterEmail)
    .digest("hex")
    .slice(0, 16);
  const redactedEmail = `deleted+${redactedId}@redacted.invalid`;
  const now = new Date();
  const counts = await db.transaction(async (transaction) => {
    const registrationRows = subject
      ? await transaction
          .select({ id: registrations.id })
          .from(registrations)
          .where(eq(registrations.participantId, subject.id))
      : [];
    const registrationIds = registrationRows.map((row) => row.id);
    if (registrationIds.length) {
      await transaction
        .delete(eventChatMessages)
        .where(inArray(eventChatMessages.registrationId, registrationIds));
      await transaction
        .delete(eventQuestions)
        .where(inArray(eventQuestions.registrationId, registrationIds));
    }
    const deletedSupport = await transaction
      .delete(supportRequests)
      .where(eq(supportRequests.requesterEmail, dataRequest.requesterEmail))
      .returning({ id: supportRequests.id });
    await transaction
      .update(auditLogs)
      .set({ actorEmail: redactedEmail })
      .where(eq(auditLogs.actorEmail, dataRequest.requesterEmail));
    if (subject) {
      await transaction.delete(users).where(eq(users.id, subject.id));
    }
    const updatedRequests = await transaction
      .update(dataSubjectRequests)
      .set({
        requesterName: "Datos eliminados",
        requesterEmail: redactedEmail,
        description: null,
        status: "completed",
        identityVerified: true,
        assignedTo: administrator.id,
        resolutionNotes:
          "Supresión ejecutada. Se conserva únicamente evidencia anonimizada y trazabilidad legal.",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(dataSubjectRequests.requesterEmail, dataRequest.requesterEmail))
      .returning();
    return {
      registrations: registrationIds.length,
      supportRequests: deletedSupport.length,
      updatedRequests,
    };
  });

  await writeAuditLog({
    actor: administrator,
    action: "privacy.data_erased",
    resourceType: "data_request",
    resourceId: dataRequest.id,
    summary: "Supresión verificada de datos personales ejecutada.",
    details: {
      registrations: counts.registrations,
      supportRequests: counts.supportRequests,
      subjectAccountRemoved: Boolean(subject),
    },
    request,
  });

  const updated =
    counts.updatedRequests.find((record) => record.id === dataRequest.id) ??
    counts.updatedRequests[0];
  return NextResponse.json({
    data: updated,
    erased: {
      registrations: counts.registrations,
      supportRequests: counts.supportRequests,
      subjectAccountRemoved: Boolean(subject),
    },
  });
}
