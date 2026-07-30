import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { dataSubjectRequests } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

const requestTypes = [
  "access",
  "correction",
  "deletion",
  "portability",
  "restriction",
] as const;
const requestStatuses = [
  "submitted",
  "verified",
  "in_progress",
  "completed",
  "rejected",
] as const;

function cleanText(value: unknown, minLength: number, maxLength: number) {
  if (typeof value !== "string") throw new Error("invalid");
  const cleaned = value.trim().replace(/\r\n/g, "\n");
  if (cleaned.length < minLength || cleaned.length > maxLength) {
    throw new Error("invalid");
  }
  return cleaned;
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("invalid");
  }
  return email;
}

async function requireAdministrator() {
  const user = await requireApiUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (user.role !== "administrator") {
    return {
      error: NextResponse.json({ error: "No autorizado." }, { status: 403 }),
    };
  }
  return { user };
}

export async function GET() {
  const auth = await requireAdministrator();
  if ("error" in auth) return auth.error;
  const data = await getDb()
    .select()
    .from(dataSubjectRequests)
    .orderBy(desc(dataSubjectRequests.createdAt))
    .limit(100);
  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    type?: (typeof requestTypes)[number];
    description?: string;
    consent?: boolean;
  };
  if (
    !body.type ||
    !requestTypes.includes(body.type) ||
    body.consent !== true
  ) {
    return NextResponse.json(
      { error: "Selecciona un derecho y acepta el tratamiento de la solicitud." },
      { status: 400 },
    );
  }

  let requesterName: string;
  let requesterEmail: string;
  let description: string | null = null;
  try {
    requesterName = cleanText(body.name, 2, 100);
    requesterEmail = cleanEmail(body.email);
    if (body.description?.trim()) {
      description = cleanText(body.description, 10, 2_000);
    }
  } catch {
    return NextResponse.json(
      { error: "Revisa el nombre, el correo y la descripción." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [duplicate] = await db
    .select({ id: dataSubjectRequests.id })
    .from(dataSubjectRequests)
    .where(
      and(
        eq(dataSubjectRequests.requesterEmail, requesterEmail),
        eq(dataSubjectRequests.type, body.type),
        inArray(dataSubjectRequests.status, [
          "submitted",
          "verified",
          "in_progress",
        ]),
        gt(
          dataSubjectRequests.createdAt,
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        ),
      ),
    )
    .limit(1);
  if (duplicate) {
    return NextResponse.json(
      {
        error:
          "Ya existe una solicitud activa del mismo tipo para este correo.",
        duplicateId: duplicate.id,
      },
      { status: 409 },
    );
  }

  const now = new Date();
  const [created] = await db
    .insert(dataSubjectRequests)
    .values({
      requesterName,
      requesterEmail,
      type: body.type,
      description,
      dueAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      consentAcceptedAt: now,
      retentionUntil: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: dataSubjectRequests.id,
      status: dataSubjectRequests.status,
      dueAt: dataSubjectRequests.dueAt,
      createdAt: dataSubjectRequests.createdAt,
    });

  await writeAuditLog({
    actorEmail: requesterEmail,
    action: "privacy.data_request.created",
    resourceType: "data_request",
    resourceId: created.id,
    summary: "Nueva solicitud de derechos sobre datos registrada.",
    details: { type: body.type, deadlineDays: 30 },
    request,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdministrator();
  if ("error" in auth) return auth.error;
  const body = (await request.json()) as {
    id?: string;
    status?: (typeof requestStatuses)[number];
    identityVerified?: boolean;
    resolutionNotes?: string;
  };
  if (
    typeof body.id !== "string" ||
    !body.status ||
    !requestStatuses.includes(body.status)
  ) {
    return NextResponse.json(
      { error: "Selecciona una solicitud y un estado válido." },
      { status: 400 },
    );
  }

  const [current] = await getDb()
    .select()
    .from(dataSubjectRequests)
    .where(eq(dataSubjectRequests.id, body.id))
    .limit(1);
  if (!current) {
    return NextResponse.json(
      { error: "Solicitud no encontrada." },
      { status: 404 },
    );
  }

  const identityVerified =
    body.identityVerified ?? current.identityVerified;
  if (body.status === "completed" && !identityVerified) {
    return NextResponse.json(
      {
        error:
          "Verifica la identidad antes de entregar, corregir o eliminar datos.",
      },
      { status: 409 },
    );
  }

  let resolutionNotes = current.resolutionNotes;
  try {
    if (body.resolutionNotes?.trim()) {
      resolutionNotes = cleanText(body.resolutionNotes, 5, 2_000);
    }
  } catch {
    return NextResponse.json(
      { error: "Las notas deben tener entre 5 y 2.000 caracteres." },
      { status: 400 },
    );
  }

  const now = new Date();
  const [updated] = await getDb()
    .update(dataSubjectRequests)
    .set({
      status: body.status,
      identityVerified,
      resolutionNotes,
      assignedTo:
        body.status === "in_progress" ? auth.user.id : current.assignedTo,
      completedAt: body.status === "completed" ? now : null,
      updatedAt: now,
    })
    .where(eq(dataSubjectRequests.id, current.id))
    .returning();

  await writeAuditLog({
    actor: auth.user,
    action: "privacy.data_request.updated",
    resourceType: "data_request",
    resourceId: updated.id,
    summary: "Solicitud de derechos sobre datos actualizada.",
    details: {
      type: updated.type,
      status: updated.status,
      identityVerified: updated.identityVerified,
    },
    request,
  });

  return NextResponse.json({ data: updated });
}
