import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  eventRegistrationFields,
  events,
  registrationFieldResponses,
  registrations,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { requireApiPermission } from "@/lib/api-guards";

export const runtime = "nodejs";

const allowedStatuses = [
  "registered",
  "confirmed",
  "attended",
  "absent",
  "cancelled",
] as const;

async function requireStaff() {
  const currentUser = await requireApiUser();
  if (!currentUser) {
    return {
      error: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (currentUser.role === "participant") {
    return {
      error: NextResponse.json({ error: "No autorizado." }, { status: 403 }),
    };
  }
  return { currentUser };
}

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const db = getDb();
  const records = await db
    .select({
      id: registrations.id,
      name: users.name,
      email: users.email,
      company: registrations.company,
      jobTitle: registrations.jobTitle,
      phone: registrations.phone,
      marketingConsent: registrations.marketingConsent,
      status: registrations.status,
      source: registrations.source,
      joinedAt: registrations.joinedAt,
      leftAt: registrations.leftAt,
      engagementScore: registrations.engagementScore,
      registeredAt: registrations.registeredAt,
      eventId: events.id,
      eventTitle: events.title,
      eventSlug: events.slug,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.participantId, users.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .orderBy(desc(registrations.registeredAt));
  const registrationIds = records.map((record) => record.id);
  const customResponses = registrationIds.length
    ? await db
        .select({
          registrationId: registrationFieldResponses.registrationId,
          fieldId: eventRegistrationFields.id,
          label: eventRegistrationFields.label,
          value: registrationFieldResponses.value,
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
  const data = records.map((record) => ({
    ...record,
    customFields: customResponses
      .filter((response) => response.registrationId === record.id)
      .map((response) => ({
        id: response.fieldId,
        label: response.label,
        value: response.value ?? "",
      })),
  }));

  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  const permissionCheck = await requireApiPermission("participants.manage");
  if ("error" in permissionCheck) return permissionCheck.error;
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    status?: (typeof allowedStatuses)[number];
  };
  if (
    typeof body.id !== "string" ||
    !body.id ||
    !allowedStatuses.includes(
      body.status as (typeof allowedStatuses)[number],
    )
  ) {
    return NextResponse.json(
      { error: "El participante o el estado no son válidos." },
      { status: 400 },
    );
  }

  const [updated] = await getDb()
    .update(registrations)
    .set({ status: body.status })
    .where(eq(registrations.id, body.id))
    .returning({
      id: registrations.id,
      status: registrations.status,
      eventId: registrations.eventId,
      participantId: registrations.participantId,
    });

  if (!updated) {
    return NextResponse.json(
      { error: "Registro no encontrado." },
      { status: 404 },
    );
  }

  await writeAuditLog({
    actor: auth.currentUser,
    action: "participant.status.updated",
    resourceType: "registration",
    resourceId: updated.id,
    summary: `Estado de participante actualizado a ${updated.status}.`,
    details: {
      status: updated.status,
      eventId: updated.eventId,
      participantId: updated.participantId,
    },
    request,
  });
  return NextResponse.json({ data: updated });
}
