import { and, count, eq, inArray } from "drizzle-orm";
import { NextResponse, after } from "next/server";
import { getDb } from "@/db";
import { authSessions, events, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiPermission } from "@/lib/api-guards";
import { hashPassword } from "@/lib/password";
import { isValidPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";
import { getPublicOrigin } from "@/lib/public-origin";
import { sendTeamAccessEmail } from "@/lib/team-notifications";

export const runtime = "nodejs";

const staffRoles = ["administrator", "organizer"] as const;
type StaffRole = (typeof staffRoles)[number];

async function requireAdministrator() {
  // El acceso al equipo se rige por permisos administrables, no por el rol fijo.
  const check = await requireApiPermission("team.manage");
  if ("error" in check) return check;
  return { user: check.user };
}

function safeMember(record: typeof users.$inferSelect) {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    active: record.active,
    lockedUntil: record.lockedUntil,
    lastLoginAt: record.lastLoginAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function cleanName(value: unknown) {
  if (typeof value !== "string") throw new Error("invalid");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) throw new Error("invalid");
  return name;
}

function cleanEmail(value: unknown) {
  if (typeof value !== "string") throw new Error("invalid");
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("invalid");
  }
  return email;
}

function cleanPassword(value: unknown) {
  if (!isValidPassword(value)) throw new Error("invalid");
  return value;
}

function cleanRole(value: unknown): StaffRole {
  if (!staffRoles.includes(value as StaffRole)) throw new Error("invalid");
  return value as StaffRole;
}

type AnyRole = StaffRole | "participant";
function cleanAnyRole(value: unknown): AnyRole {
  if (value === "participant") return value;
  return cleanRole(value);
}

export async function GET() {
  const auth = await requireAdministrator();
  if ("error" in auth) return auth.error;

  const members = await getDb()
    .select()
    .from(users)
    .where(inArray(users.role, staffRoles))
    .orderBy(users.createdAt);

  return NextResponse.json({
    data: {
      currentUserId: auth.user.id,
      members: members.map(safeMember),
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdministrator();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    role?: StaffRole;
    password?: string;
  };

  let name: string;
  let email: string;
  let role: StaffRole;
  let password: string;
  try {
    name = cleanName(body.name);
    email = cleanEmail(body.email);
    role = cleanRole(body.role);
    password = cleanPassword(body.password);
  } catch {
    return NextResponse.json(
      {
        error: `Revisa el nombre, correo, rol y la contraseña temporal. ${PASSWORD_POLICY_MESSAGE}`,
      },
      { status: 400 },
    );
  }

  const db = getDb();
  const origin = getPublicOrigin(request);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing && existing.role !== "participant") {
    return NextResponse.json(
      { error: "Ese correo ya pertenece a un miembro del equipo." },
      { status: 409 },
    );
  }

  // Un participante existente conserva su cuenta e historial: solo recibe el
  // rol de gestión y una contraseña temporal para entrar al panel.
  if (existing) {
    const [promoted] = await db
      .update(users)
      .set({
        name,
        role,
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        active: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    await db.delete(authSessions).where(eq(authSessions.userId, existing.id));
    await writeAuditLog({
      actor: auth.user,
      action: "team.member.promoted",
      resourceType: "team_member",
      resourceId: promoted.id,
      summary: `El participante ${promoted.email} recibió el rol ${promoted.role}.`,
      details: { previousRole: "participant", role: promoted.role },
      request,
    });
    after(() =>
      sendTeamAccessEmail({
        kind: "promoted",
        to: promoted.email,
        name: promoted.name,
        role: promoted.role,
        previousRole: "participant",
        temporaryPassword: password,
        origin,
        actorEmail: auth.user.email,
      }),
    );
    return NextResponse.json(
      { data: { ...safeMember(promoted), promoted: true } },
      { status: 200 },
    );
  }

  const [member] = await db
    .insert(users)
    .values({
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      active: true,
    })
    .returning();

  await writeAuditLog({
    actor: auth.user,
    action: "team.member.created",
    resourceType: "team_member",
    resourceId: member.id,
    summary: `Cuenta de equipo creada para ${member.email}.`,
    details: { role: member.role, active: member.active },
    request,
  });
  after(() =>
    sendTeamAccessEmail({
      kind: "created",
      to: member.email,
      name: member.name,
      role: member.role,
      temporaryPassword: password,
      origin,
      actorEmail: auth.user.email,
    }),
  );
  return NextResponse.json({ data: safeMember(member) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdministrator();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    role?: StaffRole | "participant";
    active?: boolean;
    password?: string;
  };
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json(
      { error: "Miembro no válido." },
      { status: 400 },
    );
  }
  const origin = getPublicOrigin(request);

  const db = getDb();
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, body.id))
    .limit(1);
  if (!target || !staffRoles.includes(target.role as StaffRole)) {
    return NextResponse.json(
      { error: "Miembro no encontrado." },
      { status: 404 },
    );
  }

  if (
    target.id === auth.user.id &&
    (body.active === false ||
      body.role === "organizer" ||
      body.role === "participant" ||
      body.password !== undefined)
  ) {
    return NextResponse.json(
      { error: "No puedes desactivar, degradar o restablecer tu propia cuenta desde Equipo." },
      { status: 400 },
    );
  }

  let role: AnyRole = target.role as StaffRole;
  let passwordHash = target.passwordHash;
  try {
    if (body.role !== undefined) role = cleanAnyRole(body.role);
    if (body.active !== undefined && typeof body.active !== "boolean") {
      throw new Error("invalid");
    }
    if (body.password !== undefined) {
      passwordHash = await hashPassword(cleanPassword(body.password));
    }
  } catch {
    return NextResponse.json(
      {
        error: `La actualización no es válida. ${PASSWORD_POLICY_MESSAGE}`,
      },
      { status: 400 },
    );
  }

  const active = body.active ?? target.active;
  const removesActiveAdministrator =
    target.role === "administrator" &&
    target.active &&
    (role !== "administrator" || !active);
  if (removesActiveAdministrator) {
    const [summary] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.role, "administrator"), eq(users.active, true)));
    if ((summary?.total ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Debe existir al menos un administrador activo." },
        { status: 400 },
      );
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      role,
      active,
      passwordHash,
      passwordChangedAt:
        body.password !== undefined ? new Date() : target.passwordChangedAt,
      failedLoginAttempts:
        body.password !== undefined || active ? 0 : target.failedLoginAttempts,
      lockedUntil:
        body.password !== undefined || active ? null : target.lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(users.id, target.id))
    .returning();

  if (body.password !== undefined || !active || role !== target.role) {
    await db.delete(authSessions).where(eq(authSessions.userId, target.id));
  }

  await writeAuditLog({
    actor: auth.user,
    action: "team.member.updated",
    resourceType: "team_member",
    resourceId: target.id,
    summary: `Acceso de ${target.email} actualizado.`,
    details: {
      previousRole: target.role,
      role,
      previousActive: target.active,
      active,
      passwordReset: body.password !== undefined,
    },
    request,
  });
  if (role !== target.role || body.password !== undefined) {
    const kind = role !== target.role ? "role_changed" : "password_reset";
    after(() =>
      sendTeamAccessEmail({
        kind,
        to: updated.email,
        name: updated.name,
        role: updated.role,
        previousRole: target.role,
        temporaryPassword: body.password ?? null,
        origin,
        actorEmail: auth.user.email,
      }),
    );
  }
  return NextResponse.json({ data: safeMember(updated) });
}

export async function DELETE(request: Request) {
  const auth = await requireAdministrator();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { id?: string };
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Miembro no válido." }, { status: 400 });
  }
  if (body.id === auth.user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, body.id))
    .limit(1);
  if (!target || !staffRoles.includes(target.role as StaffRole)) {
    return NextResponse.json({ error: "Miembro no encontrado." }, { status: 404 });
  }

  if (target.role === "administrator" && target.active) {
    const [summary] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.role, "administrator"), eq(users.active, true)));
    if ((summary?.total ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Debe existir al menos un administrador activo." },
        { status: 400 },
      );
    }
  }

  const [created] = await db
    .select({ total: count() })
    .from(events)
    .where(eq(events.createdBy, target.id));
  if ((created?.total ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `La cuenta creó ${created!.total} evento${created!.total === 1 ? "" : "s"} y no puede eliminarse para conservar la trazabilidad. Desactívala en su lugar.`,
      },
      { status: 409 },
    );
  }

  await db.delete(users).where(eq(users.id, target.id));

  await writeAuditLog({
    actor: auth.user,
    action: "team.member.deleted",
    resourceType: "team_member",
    resourceId: target.id,
    summary: `Cuenta de equipo ${target.email} eliminada definitivamente.`,
    details: { role: target.role },
    request,
  });
  return NextResponse.json({ data: { deleted: true } });
}
