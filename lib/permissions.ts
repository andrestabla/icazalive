import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rolePermissions, userPermissions } from "@/db/schema";
import type { AuthenticatedUser } from "@/lib/auth";

export type StaffRole = "administrator" | "organizer";
export type AppRole = StaffRole | "participant";

// Catálogo de permisos. Cada módulo declara su ruta y las acciones que
// pueden concederse o revocarse por rol y por usuario.
export const permissionCatalog = [
  {
    module: "dashboard",
    label: "Resumen",
    path: "/",
    permissions: [{ key: "dashboard.view", label: "Ver el resumen" }],
  },
  {
    module: "events",
    label: "Eventos",
    path: "/events",
    permissions: [
      { key: "events.view", label: "Ver eventos" },
      { key: "events.manage", label: "Crear y editar eventos" },
      { key: "events.moderate", label: "Moderar la sala y el estudio" },
    ],
  },
  {
    module: "participants",
    label: "Participantes",
    path: "/participants",
    permissions: [
      { key: "participants.view", label: "Ver participantes" },
      { key: "participants.manage", label: "Invitar, importar y cambiar estados" },
    ],
  },
  {
    module: "analytics",
    label: "Analítica",
    path: "/analytics",
    permissions: [{ key: "analytics.view", label: "Ver analítica y reportes" }],
  },
  {
    module: "integrations",
    label: "Integraciones",
    path: "/integrations",
    permissions: [
      { key: "integrations.view", label: "Ver integraciones" },
      { key: "integrations.manage", label: "Configurar integraciones" },
    ],
  },
  {
    module: "content",
    label: "Contenidos",
    path: "/content",
    permissions: [
      { key: "content.view", label: "Ver la biblioteca de contenidos" },
      { key: "content.manage", label: "Administrar contenidos y plantillas" },
    ],
  },
  {
    module: "brand",
    label: "Marca",
    path: "/brand",
    permissions: [
      { key: "brand.view", label: "Ver la marca" },
      { key: "brand.manage", label: "Editar la marca" },
    ],
  },
  {
    module: "team",
    label: "Equipo",
    path: "/team",
    permissions: [
      { key: "team.view", label: "Ver el equipo" },
      { key: "team.manage", label: "Crear, editar y eliminar cuentas" },
    ],
  },
  {
    module: "permissions",
    label: "Permisos",
    path: "/permissions",
    permissions: [
      { key: "permissions.manage", label: "Administrar permisos de roles y usuarios" },
    ],
  },
  {
    module: "audit",
    label: "Auditoría",
    path: "/audit",
    permissions: [{ key: "audit.view", label: "Consultar la bitácora" }],
  },
  {
    module: "privacy",
    label: "Privacidad",
    path: "/privacy/manage",
    permissions: [
      { key: "privacy.view", label: "Ver solicitudes y documentos" },
      { key: "privacy.manage", label: "Publicar documentos y resolver solicitudes" },
    ],
  },
] as const;

export type PermissionKey =
  (typeof permissionCatalog)[number]["permissions"][number]["key"];

export const allPermissionKeys: PermissionKey[] = permissionCatalog.flatMap(
  (entry) => entry.permissions.map((permission) => permission.key),
) as PermissionKey[];

// Valores de fábrica. El administrador puede modificarlos desde /permissions;
// los cambios se guardan en la base y estos quedan como referencia inicial.
export const factoryRoleDefaults: Record<StaffRole, PermissionKey[]> = {
  administrator: allPermissionKeys,
  organizer: [
    "dashboard.view",
    "events.view",
    "events.manage",
    "events.moderate",
    "participants.view",
    "participants.manage",
    "analytics.view",
    "integrations.view",
    "brand.view",
    "content.view",
  ],
};

// Permisos que el administrador nunca puede perder: evitan dejar la
// plataforma sin quién administre los accesos.
export const lockedAdministratorPermissions: PermissionKey[] = [
  "permissions.manage",
  "team.view",
  "team.manage",
];

export const moduleByPermission = new Map<PermissionKey, string>(
  permissionCatalog.flatMap((entry) =>
    entry.permissions.map((permission) => [permission.key, entry.module] as const),
  ),
);

export function permissionLabel(key: PermissionKey): string {
  for (const entry of permissionCatalog) {
    for (const permission of entry.permissions) {
      if (permission.key === key) return permission.label;
    }
  }
  return key;
}

export type EffectivePermissions = {
  granted: Set<PermissionKey>;
  roleGranted: Set<PermissionKey>;
  overrides: Map<PermissionKey, boolean>;
};

export async function getRoleDefaults(): Promise<Record<StaffRole, Set<PermissionKey>>> {
  const rows = await getDb().select().from(rolePermissions);
  const result: Record<StaffRole, Set<PermissionKey>> = {
    administrator: new Set(),
    organizer: new Set(),
  };
  const configuredRoles = new Set(rows.map((row) => row.role));

  for (const role of ["administrator", "organizer"] as StaffRole[]) {
    if (configuredRoles.has(role)) {
      for (const row of rows) {
        if (row.role === role && row.allowed) {
          result[role].add(row.permission as PermissionKey);
        }
      }
    } else {
      // Sin configuración guardada todavía: se usan los valores de fábrica.
      for (const key of factoryRoleDefaults[role]) result[role].add(key);
    }
  }
  // El administrador conserva siempre los permisos bloqueados.
  for (const key of lockedAdministratorPermissions) {
    result.administrator.add(key);
  }
  return result;
}

export async function getEffectivePermissions(
  user: Pick<AuthenticatedUser, "id" | "role">,
): Promise<EffectivePermissions> {
  if (user.role === "participant") {
    return { granted: new Set(), roleGranted: new Set(), overrides: new Map() };
  }

  const defaults = await getRoleDefaults();
  const roleGranted = new Set(defaults[user.role as StaffRole] ?? []);

  const overrideRows = await getDb()
    .select()
    .from(userPermissions)
    .where(eq(userPermissions.userId, user.id));

  const overrides = new Map<PermissionKey, boolean>();
  const granted = new Set(roleGranted);
  for (const row of overrideRows) {
    const key = row.permission as PermissionKey;
    overrides.set(key, row.allowed);
    if (row.allowed) granted.add(key);
    else granted.delete(key);
  }

  if (user.role === "administrator") {
    for (const key of lockedAdministratorPermissions) granted.add(key);
  }
  return { granted, roleGranted, overrides };
}

export async function userCan(
  user: Pick<AuthenticatedUser, "id" | "role">,
  permission: PermissionKey,
): Promise<boolean> {
  const { granted } = await getEffectivePermissions(user);
  return granted.has(permission);
}

export async function setRolePermission(
  role: StaffRole,
  permission: PermissionKey,
  allowed: boolean,
) {
  const db = getDb();
  // La primera edición materializa todos los valores vigentes del rol.
  const existing = await db
    .select({ id: rolePermissions.id })
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role))
    .limit(1);
  if (!existing.length) {
    const defaults = factoryRoleDefaults[role];
    await db.insert(rolePermissions).values(
      allPermissionKeys.map((key) => ({
        role,
        permission: key,
        allowed: defaults.includes(key),
      })),
    );
  }

  const [row] = await db
    .select({ id: rolePermissions.id })
    .from(rolePermissions)
    .where(
      and(eq(rolePermissions.role, role), eq(rolePermissions.permission, permission)),
    )
    .limit(1);
  if (row) {
    await db
      .update(rolePermissions)
      .set({ allowed, updatedAt: new Date() })
      .where(eq(rolePermissions.id, row.id));
  } else {
    await db.insert(rolePermissions).values({ role, permission, allowed });
  }
}

export async function setUserPermission(
  userId: string,
  permission: PermissionKey,
  allowed: boolean | null,
) {
  const db = getDb();
  await db
    .delete(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permission, permission),
      ),
    );
  if (allowed !== null) {
    await db.insert(userPermissions).values({ userId, permission, allowed });
  }
}
