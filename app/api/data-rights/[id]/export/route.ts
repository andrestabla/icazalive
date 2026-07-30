import { createHash } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  consentRecords,
  dataSubjectRequests,
  eventRegistrationFields,
  events,
  registrationFieldResponses,
  registrations,
  supportRequests,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role !== "administrator") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
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
  if (
    !dataRequest.identityVerified ||
    (dataRequest.type !== "access" && dataRequest.type !== "portability")
  ) {
    return NextResponse.json(
      {
        error:
          "La exportación requiere identidad verificada y una solicitud de acceso o portabilidad.",
      },
      { status: 409 },
    );
  }

  const [subject] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.email, dataRequest.requesterEmail))
    .limit(1);
  const emailHash = createHash("sha256")
    .update(dataRequest.requesterEmail)
    .digest("hex");

  const [registrationData, consentData, supportData, requestHistory] =
    await Promise.all([
      subject
        ? db
            .select({
              id: registrations.id,
              eventTitle: events.title,
              eventSlug: events.slug,
              status: registrations.status,
              company: registrations.company,
              jobTitle: registrations.jobTitle,
              phone: registrations.phone,
              marketingConsent: registrations.marketingConsent,
              consentAcceptedAt: registrations.consentAcceptedAt,
              registeredAt: registrations.registeredAt,
              joinedAt: registrations.joinedAt,
              leftAt: registrations.leftAt,
            })
            .from(registrations)
            .innerJoin(events, eq(registrations.eventId, events.id))
            .where(eq(registrations.participantId, subject.id))
            .orderBy(asc(registrations.registeredAt))
        : [],
      db
        .select({
          eventId: consentRecords.eventId,
          privacyVersion: consentRecords.privacyVersion,
          termsVersion: consentRecords.termsVersion,
          privacyAccepted: consentRecords.privacyAccepted,
          marketingAccepted: consentRecords.marketingAccepted,
          consentText: consentRecords.consentText,
          acceptedAt: consentRecords.acceptedAt,
        })
        .from(consentRecords)
        .where(eq(consentRecords.subjectEmailHash, emailHash))
        .orderBy(asc(consentRecords.acceptedAt)),
      db
        .select({
          id: supportRequests.id,
          category: supportRequests.category,
          subject: supportRequests.subject,
          description: supportRequests.description,
          status: supportRequests.status,
          createdAt: supportRequests.createdAt,
        })
        .from(supportRequests)
        .where(eq(supportRequests.requesterEmail, dataRequest.requesterEmail))
        .orderBy(asc(supportRequests.createdAt)),
      db
        .select({
          id: dataSubjectRequests.id,
          type: dataSubjectRequests.type,
          status: dataSubjectRequests.status,
          identityVerified: dataSubjectRequests.identityVerified,
          dueAt: dataSubjectRequests.dueAt,
          createdAt: dataSubjectRequests.createdAt,
          completedAt: dataSubjectRequests.completedAt,
        })
        .from(dataSubjectRequests)
        .where(
          eq(
            dataSubjectRequests.requesterEmail,
            dataRequest.requesterEmail,
          ),
        )
        .orderBy(asc(dataSubjectRequests.createdAt)),
    ]);
  const registrationIds = registrationData.map((registration) => registration.id);
  const customRegistrationResponses = registrationIds.length
    ? await db
        .select({
          registrationId: registrationFieldResponses.registrationId,
          fieldLabel: eventRegistrationFields.label,
          value: registrationFieldResponses.value,
          createdAt: registrationFieldResponses.createdAt,
          updatedAt: registrationFieldResponses.updatedAt,
        })
        .from(registrationFieldResponses)
        .innerJoin(
          eventRegistrationFields,
          eq(registrationFieldResponses.fieldId, eventRegistrationFields.id),
        )
        .where(
          inArray(
            registrationFieldResponses.registrationId,
            registrationIds,
          ),
        )
    : [];

  const payload = {
    generatedAt: new Date().toISOString(),
    requestId: dataRequest.id,
    subject: subject ?? {
      email: dataRequest.requesterEmail,
      note: "No existe una cuenta activa con este correo.",
    },
    registrations: registrationData,
    customRegistrationResponses,
    consentEvidence: consentData,
    supportRequests: supportData,
    dataRightsRequests: requestHistory,
  };

  await writeAuditLog({
    actor: user,
    action: "privacy.data_exported",
    resourceType: "data_request",
    resourceId: dataRequest.id,
    summary: "Exportación verificada de datos personales generada.",
    details: {
      requestType: dataRequest.type,
      registrations: registrationData.length,
      consents: consentData.length,
    },
    request,
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="icaza-live-datos-${dataRequest.id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
