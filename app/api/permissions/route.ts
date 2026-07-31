import { asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { userPermissions, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import {
  allPermissionKeys,
  getRoleDefaults,
  lockedAdministratorPermissions,
  permissionCatalog,
  permissionLabel,
  setRolePermission,
  setUserPermission,
  userCan,
  type PermissionKey,
  type StaffRole,
} from "@/lib/permissions";

export const runtime = "nodejs";

async function requirePermissionManager() {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (!(await userCan(user, "permissions.manage"))) {
    return {
      error: NextResponse.json(
        { error: "No tienes permiso para administrar accesos." },
        { status: 403 },
      ),
    };
  }
  return { user };
}

export async function GET() {
  const auth = await requirePermissionManager();
  if ("error" in auth) return auth.error;

  const db = getDb();
  const [defaults, staff, overrides] = await Promise.all([
    getRoleDefaults(),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
      })
      .from(users)
      .where(inArray(users.role, ["administrator", "organizer"]))
      .orderBy(asc(users.name)),
    db.select().from(userPermissions),
  ]);

  return NextResponse.json({
    data: {
      catalog: permissionCatalog,
      lockedForAdministrator: lockedAdministratorPermissions,
      roleDefaults: {
        administrator: Array.from(defaults.administrator),
        organizer: Array.from(defaults.organizer),
      },
      users: staff.map((member) => ({
        ...member,
        overrides: overrides
          .filter((override) => override.userId === member.id)
          .map((override) => ({
            permission: override.permission,
            allowed: override.allowed,
          })),
      })),
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requirePermissionManager();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    scope?: "role" | "user";
    role?: StaffRole;
    userId?: string;
    permission?: string;
    allowed?: boolean | null;
  };

  const permission = body.permission as PermissionKey | undefined;
  if (!permission || !allPermissionKeys.includes(permission)) {
    return NextResponse.json({ error: "Permiso no válido." }, { status: 400 });
  }

  if (body.scope === "role") {
    if (body.role !== "administrator" && body.role !== "organizer") {
      return NextResponse.json({ error: "Rol no válido." }, { status: 400 });
    }
    if (typeof body.allowed !== "boolean") {
      return NextResponse.json(
        { error: "Indica si el permiso queda activo." },
        { status: 400 },
      );
    }
    if (
      body.role === "administrator" &&
      lockedAdministratorPermissions.includes(permission) &&
      !body.allowed
    ) {
      return NextResponse.json(
        {
          error:
            "Este permiso es obligatorio para el rol administrador y no puede retirarse.",
        },
        { status: 409 },
      );
    }
    await setRolePermission(body.role, permission, body.allowed);
    await writeAuditLog({
      actor: auth.user,
      action: "permissions.role.updated",
      resourceType: "permissions",
      resourceId: body.role,
      summary: `Permiso “${permissionLabel(permission)}” ${body.allowed ? "concedido" : "retirado"} al rol ${body.role === "administrator" ? "administrador" : "organizador"}.`,
      details: { permission, allowed: body.allowed },
      request,
    });
    return NextResponse.json({ data: { updated: true } });
  }

  if (body.scope === "user") {
    if (!body.userId) {
      return NextResponse.json({ error: "Usuario no válido." }, { status: 400 });
    }
    const db = getDb();
    const [target] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(inArray(users.id, [body.userId]))
      .limit(1);
    if (!target || target.role === "participant") {
      return NextResponse.json(
        { error: "Solo las cuentas de equipo tienen permisos administrables." },
        { status: 400 },
      );
    }
    if (
      target.role === "administrator" &&
      lockedAdministratorPermissions.includes(permission) &&
      body.allowed === false
    ) {
      return NextResponse.json(
        {
          error:
            "Este permiso es obligatorio para las cuentas administradoras y no puede retirarse.",
        },
        { status: 409 },
      );
    }
    if (
      target.id === auth.user.id &&
      permission === "permissions.manage" &&
      body.allowed === false
    ) {
      return NextResponse.json(
        { error: "No puedes quitarte a ti mismo la administración de permisos." },
        { status: 409 },
      );
    }
    await setUserPermission(
      body.userId,
      permission,
      body.allowed === undefined ? null : body.allowed,
    );
    await writeAuditLog({
      actor: auth.user,
      action: "permissions.user.updated",
      resourceType: "permissions",
      resourceId: body.userId,
      summary: `Permiso “${permissionLabel(permission)}” de ${target.name}: ${
        body.allowed === null || body.allowed === undefined
          ? "vuelve al valor del rol"
          : body.allowed
            ? "concedido"
            : "retirado"
      }.`,
      details: { permission, allowed: body.allowed ?? null },
      request,
    });
    return NextResponse.json({ data: { updated: true } });
  }

  return NextResponse.json({ error: "Alcance no válido." }, { status: 400 });
}
