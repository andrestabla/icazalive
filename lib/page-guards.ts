import { redirect } from "next/navigation";
import { requirePageUser, type AuthenticatedUser } from "@/lib/auth";
import {
  getEffectivePermissions,
  type PermissionKey,
} from "@/lib/permissions";

export type GuardedPage = {
  user: AuthenticatedUser;
  granted: Set<PermissionKey>;
};

// Verifica sesión y permiso de módulo. Si falta el permiso, lleva a una
// pantalla explicativa en lugar de un 404 o una redirección silenciosa.
export async function requirePermission(
  permission: PermissionKey,
): Promise<GuardedPage> {
  const user = await requirePageUser();
  const { granted } = await getEffectivePermissions(user);
  if (!granted.has(permission)) {
    redirect(`/sin-acceso?permiso=${encodeURIComponent(permission)}`);
  }
  return { user, granted };
}
