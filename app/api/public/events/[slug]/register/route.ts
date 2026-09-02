import { createHash } from "node:crypto";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { NextResponse, after } from "next/server";
import { getDb } from "@/db";
import {
  communicationDeliveries,
  communicationMessages,
  consentRecords,
  eventRegistrationFields,
  events,
  registrationAccessTokens,
  registrationFieldResponses,
  registrations,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { renderParticipantCommunication } from "@/lib/communication-renderer";
import { getPublicOrigin } from "@/lib/public-origin";
import { isStaleDelivery, triggerDeliveries } from "@/lib/communication-worker";
import { getPublishedLegalDocuments } from "@/lib/privacy";
import { createRegistrationAccessToken } from "@/lib/registration-access";
import { validateRegistrationResponses } from "@/lib/registration-fields";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    privacyConsent?: boolean;
    termsConsent?: boolean;
    marketingConsent?: boolean;
    privacyDocumentId?: string;
    termsDocumentId?: string;
    customResponses?: unknown;
  };

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !name ||
    name.length < 2 ||
    name.length > 100 ||
    !email ||
    email.length > 254 ||
    !emailPattern.test(email) ||
    body.privacyConsent !== true ||
    body.termsConsent !== true
  ) {
    return NextResponse.json(
      { error: "Revisa los datos requeridos y acepta la política de privacidad." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [[event], legalDocuments] = await Promise.all([
    db.select().from(events).where(eq(events.slug, slug)).limit(1),
    getPublishedLegalDocuments(),
  ]);

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (
    !event.registrationOpen ||
    event.status === "cancelled" ||
    event.status === "completed"
  ) {
    return NextResponse.json(
      { error: "El registro para este evento está cerrado." },
      { status: 409 },
    );
  }
  if (
    body.privacyDocumentId !== legalDocuments.privacy.id ||
    body.termsDocumentId !== legalDocuments.terms.id
  ) {
    return NextResponse.json(
      {
        error:
          "Los documentos legales se actualizaron. Recarga la página y revisa las nuevas versiones.",
      },
      { status: 409 },
    );
  }
  const customFields = await db
    .select()
    .from(eventRegistrationFields)
    .where(
      and(
        eq(eventRegistrationFields.eventId, event.id),
        eq(eventRegistrationFields.active, true),
      ),
    )
    .orderBy(
      asc(eventRegistrationFields.position),
      asc(eventRegistrationFields.createdAt),
    );
  const validatedResponses = validateRegistrationResponses(
    customFields,
    body.customResponses,
  );
  if (validatedResponses.error) {
    return NextResponse.json(
      { error: validatedResponses.error },
      { status: 400 },
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const origin = getPublicOrigin(request);
  const emailHash = createHash("sha256").update(email).digest("hex");
  const result = await db.transaction(async (transaction) => {
    const [summary] = await transaction
      .select({ total: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, event.id),
          ne(registrations.status, "cancelled"),
        ),
      );

    if ((summary?.total ?? 0) >= event.maxAttendees) {
      return { full: true as const };
    }

    const [participant] = await transaction
      .insert(users)
      .values({
        email,
        name,
        role: "participant",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { name, active: true, updatedAt: new Date() },
      })
      .returning({ id: users.id });

    const [registration] = await transaction
      .insert(registrations)
      .values({
        eventId: event.id,
        participantId: participant.id,
        status: "registered",
        company: body.company?.trim().slice(0, 150) || null,
        jobTitle: body.jobTitle?.trim().slice(0, 150) || null,
        phone: body.phone?.trim().slice(0, 40) || null,
        marketingConsent: body.marketingConsent === true,
        consentAcceptedAt: new Date(),
        source: "registration_page",
      })
      .onConflictDoUpdate({
        target: [registrations.eventId, registrations.participantId],
        set: {
          status: "registered",
          company: body.company?.trim().slice(0, 150) || null,
          jobTitle: body.jobTitle?.trim().slice(0, 150) || null,
          phone: body.phone?.trim().slice(0, 40) || null,
          marketingConsent: body.marketingConsent === true,
          consentAcceptedAt: new Date(),
        },
      })
      .returning({ id: registrations.id });

    await transaction.insert(consentRecords).values({
      registrationId: registration.id,
      participantId: participant.id,
      eventId: event.id,
      privacyDocumentId: legalDocuments.privacy.id,
      termsDocumentId: legalDocuments.terms.id,
      privacyVersion: legalDocuments.privacy.version,
      termsVersion: legalDocuments.terms.version,
      subjectEmailHash: emailHash,
      privacyAccepted: true,
      marketingAccepted: body.marketingConsent === true,
      consentText: `Aceptó Política de privacidad v${legalDocuments.privacy.version} y Términos de uso v${legalDocuments.terms.version}. Marketing: ${body.marketingConsent === true ? "sí" : "no"}.`,
      ipAddress,
      userAgent,
      acceptedAt: new Date(),
    });

    const access = createRegistrationAccessToken();
    const accessExpiresAt = new Date(
      Math.max(
        event.endsAt.getTime() + 7 * 24 * 60 * 60 * 1000,
        Date.now() + 24 * 60 * 60 * 1000,
      ),
    );
    await transaction
      .insert(registrationAccessTokens)
      .values({
        registrationId: registration.id,
        tokenHash: access.tokenHash,
        expiresAt: accessExpiresAt,
      })
      .onConflictDoUpdate({
        target: registrationAccessTokens.registrationId,
        set: {
          tokenHash: access.tokenHash,
          expiresAt: accessExpiresAt,
          updatedAt: new Date(),
        },
      });

    await transaction
      .delete(registrationFieldResponses)
      .where(eq(registrationFieldResponses.registrationId, registration.id));
    if (validatedResponses.values.length) {
      await transaction.insert(registrationFieldResponses).values(
        validatedResponses.values.map((response) => ({
          registrationId: registration.id,
          fieldId: response.fieldId,
          value: response.value,
        })),
      );
    }

    const messages = await transaction
      .select()
      .from(communicationMessages)
      .where(
        and(
          eq(communicationMessages.eventId, event.id),
          eq(communicationMessages.enabled, true),
        ),
      );

    const now = new Date();
    for (const message of messages) {
      const scheduledFor =
        message.type === "registration_confirmation"
          ? now
          : message.type === "live_now"
            ? event.endsAt // se libera al pasar a EN VIVO; si no, el worker la cancela
            : new Date(event.startsAt.getTime() + message.offsetMinutes * 60_000);
      const status =
        message.type !== "live_now" &&
          (message.type === "registration_confirmation" ||
        scheduledFor.getTime() <= now.getTime())
          ? isStaleDelivery(message.type, scheduledFor, now)
            ? ("cancelled" as const)
            : ("queued" as const)
          : ("scheduled" as const);
      const renderingInput = {
        participantName: name,
        eventTitle: event.title,
        eventSlug: event.slug,
        startsAt: event.startsAt,
        timezone: event.timezone,
        origin,
        accessToken: access.token,
      };
      const subject = renderParticipantCommunication({
        template: message.subject,
        ...renderingInput,
      }).body;
      const renderedBody = renderParticipantCommunication({
        template: message.body,
        includeManagementFooter:
          message.type === "registration_confirmation",
        ...renderingInput,
      }).body;

      await transaction
        .insert(communicationDeliveries)
        .values({
          eventId: event.id,
          registrationId: registration.id,
          messageId: message.id,
          type: message.type,
          status,
          recipientEmail: email,
          subject,
          body: renderedBody,
          scheduledFor,
        })
        .onConflictDoUpdate({
          target: [
            communicationDeliveries.registrationId,
            communicationDeliveries.type,
          ],
          set: {
            messageId: message.id,
            status,
            recipientEmail: email,
            subject,
            body: renderedBody,
            scheduledFor,
            sentAt: null,
            error: null,
            updatedAt: now,
          },
        });
    }

    return {
      full: false as const,
      registrationId: registration.id,
      accessToken: access.token,
    };
  });

  if (result.full) {
    return NextResponse.json(
      { error: "El evento alcanzó su capacidad máxima." },
      { status: 409 },
    );
  }

  // La confirmación sale en cuanto se responde al asistente.
  after(() => triggerDeliveries(event.id));

  await writeAuditLog({
    actorEmail: email,
    action: "privacy.consent.recorded",
    resourceType: "consent",
    resourceId: result.registrationId,
    summary: "Consentimiento de registro versionado.",
    details: {
      privacyVersion: legalDocuments.privacy.version,
      termsVersion: legalDocuments.terms.version,
      marketingAccepted: body.marketingConsent === true,
      customFields: validatedResponses.values.length,
    },
    request,
  });

  const encodedToken = encodeURIComponent(result.accessToken);
  return NextResponse.json(
    {
      data: {
        registrationId: result.registrationId,
        event: { title: event.title, startsAt: event.startsAt },
        accessUrl: `/room/${event.slug}?access=${encodedToken}`,
        manageUrl: `/manage-registration/${event.slug}?access=${encodedToken}`,
        calendarUrl: `/api/public/events/${event.slug}/calendar?access=${encodedToken}`,
      },
    },
    { status: 201 },
  );
}
