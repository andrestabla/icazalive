import { and, count, eq, ne } from "drizzle-orm";
import { getPublicOrigin } from "@/lib/public-origin";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  communicationDeliveries,
  communicationMessages,
  events,
  registrationAccessTokens,
  registrations,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { requireApiPermission } from "@/lib/api-guards";
import {
  createParticipantUrls,
  renderParticipantCommunication,
} from "@/lib/communication-renderer";
import { createRegistrationAccessToken } from "@/lib/registration-access";

export const runtime = "nodejs";

type InvitationInput = {
  name?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
};

export async function POST(request: Request) {
  const permissionCheck = await requireApiPermission("participants.manage");
  if ("error" in permissionCheck) return permissionCheck.error;
  const currentUser = await requireApiUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (currentUser.role === "participant") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    eventId?: string;
    source?: "manual" | "import";
    sendInvitation?: boolean;
    participants?: InvitationInput[];
  };
  if (
    !body.eventId ||
    !Array.isArray(body.participants) ||
    body.participants.length === 0 ||
    body.participants.length > 500
  ) {
    return NextResponse.json(
      { error: "Selecciona un evento y agrega entre 1 y 500 participantes." },
      { status: 400 },
    );
  }

  const source = body.source === "manual" ? "manual" : "import";
  const sendInvitation = body.sendInvitation !== false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seenEmails = new Set<string>();
  const skipped: { row: number; email: string; reason: string }[] = [];
  const normalized = body.participants.flatMap((participant, index) => {
    const name = participant.name?.trim() ?? "";
    const email = participant.email?.trim().toLowerCase() ?? "";
    if (
      name.length < 2 ||
      name.length > 100 ||
      email.length > 254 ||
      !emailPattern.test(email)
    ) {
      skipped.push({
        row: index + 1,
        email,
        reason: "Nombre o correo no válido.",
      });
      return [];
    }
    if (seenEmails.has(email)) {
      skipped.push({
        row: index + 1,
        email,
        reason: "Correo duplicado dentro de la carga.",
      });
      return [];
    }
    seenEmails.add(email);
    return [
      {
        name,
        email,
        company: participant.company?.trim().slice(0, 150) || null,
        jobTitle: participant.jobTitle?.trim().slice(0, 150) || null,
        phone: participant.phone?.trim().slice(0, 40) || null,
      },
    ];
  });
  if (!normalized.length) {
    return NextResponse.json(
      { error: "No se encontraron participantes válidos.", skipped },
      { status: 400 },
    );
  }

  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, body.eventId))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (event.status === "cancelled" || event.status === "completed") {
    return NextResponse.json(
      { error: "No se pueden enviar invitaciones a un evento finalizado." },
      { status: 409 },
    );
  }

  const messages = sendInvitation
    ? await db
        .select()
        .from(communicationMessages)
        .where(
          and(
            eq(communicationMessages.eventId, event.id),
            eq(communicationMessages.enabled, true),
          ),
        )
    : [];
  const origin = getPublicOrigin(request);
  const now = new Date();

  const result = await db.transaction(async (transaction) => {
    const [capacity] = await transaction
      .select({ total: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, event.id),
          ne(registrations.status, "cancelled"),
        ),
      );
    let activeCount = capacity?.total ?? 0;
    const invited: {
      email: string;
      name: string;
      registrationId: string;
      accessUrl: string;
      manageUrl: string;
      created: boolean;
    }[] = [];

    for (const participantInput of normalized) {
      const [participant] = await transaction
        .insert(users)
        .values({
          email: participantInput.email,
          name: participantInput.name,
          role: "participant",
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: participantInput.name,
            active: true,
            updatedAt: now,
          },
        })
        .returning({ id: users.id });

      const [existing] = await transaction
        .select({
          id: registrations.id,
          status: registrations.status,
        })
        .from(registrations)
        .where(
          and(
            eq(registrations.eventId, event.id),
            eq(registrations.participantId, participant.id),
          ),
        )
        .limit(1);
      const consumesSeat = !existing || existing.status === "cancelled";
      if (consumesSeat && activeCount >= event.maxAttendees) {
        skipped.push({
          row: invited.length + 1,
          email: participantInput.email,
          reason: "El evento alcanzó su capacidad máxima.",
        });
        continue;
      }

      const [registration] = await transaction
        .insert(registrations)
        .values({
          eventId: event.id,
          participantId: participant.id,
          status: "confirmed",
          company: participantInput.company,
          jobTitle: participantInput.jobTitle,
          phone: participantInput.phone,
          source,
        })
        .onConflictDoUpdate({
          target: [registrations.eventId, registrations.participantId],
          set: {
            status: existing?.status === "attended" ? "attended" : "confirmed",
            company: participantInput.company,
            jobTitle: participantInput.jobTitle,
            phone: participantInput.phone,
            source,
          },
        })
        .returning({ id: registrations.id });
      if (consumesSeat) activeCount += 1;

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
            updatedAt: now,
          },
        });

      for (const message of messages) {
        const scheduledFor =
          message.type === "registration_confirmation"
            ? now
            : new Date(event.startsAt.getTime() + message.offsetMinutes * 60_000);
        const deliveryStatus =
          message.type === "registration_confirmation" ||
          scheduledFor.getTime() <= now.getTime()
            ? ("queued" as const)
            : ("scheduled" as const);
        const renderingInput = {
          participantName: participantInput.name,
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
            status: deliveryStatus,
            recipientEmail: participantInput.email,
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
              status: deliveryStatus,
              recipientEmail: participantInput.email,
              subject,
              body: renderedBody,
              scheduledFor,
              sentAt: null,
              error: null,
              updatedAt: now,
            },
          });
      }

      const urls = createParticipantUrls({
        origin,
        eventSlug: event.slug,
        accessToken: access.token,
      });
      invited.push({
        email: participantInput.email,
        name: participantInput.name,
        registrationId: registration.id,
        accessUrl: urls.accessUrl,
        manageUrl: urls.manageUrl,
        created: !existing,
      });
    }
    return invited;
  });

  const created = result.filter((item) => item.created).length;
  const updated = result.length - created;
  await writeAuditLog({
    actor: currentUser,
    action: "participant.invitation.batch.created",
    resourceType: "registration",
    resourceId: event.id,
    summary: `${result.length} invitación${result.length === 1 ? "" : "es"} preparada${result.length === 1 ? "" : "s"} para “${event.title}”.`,
    details: {
      eventId: event.id,
      source,
      created,
      updated,
      skipped: skipped.length,
      communicationsQueued: sendInvitation && messages.length > 0,
    },
    request,
  });

  return NextResponse.json(
    {
      data: {
        event: { id: event.id, title: event.title, slug: event.slug },
        summary: {
          received: body.participants.length,
          created,
          updated,
          skipped: skipped.length,
          queued: sendInvitation && messages.length ? result.length : 0,
        },
        invitations: result.slice(0, 50),
        skipped: skipped.slice(0, 100),
      },
    },
    { status: 201 },
  );
}
