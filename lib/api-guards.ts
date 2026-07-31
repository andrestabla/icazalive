import { NextResponse } from "next/server";
import { requireApiUser, type AuthenticatedUser } from "@/lib/auth";
import { getEffectivePermissions, type PermissionKey } from "@/lib/permissions";

// Comprueba sesión y permiso antes de ejecutar una acción de API.
export async function requireApiPermission(
  permission: PermissionKey,
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  const { granted } = await getEffectivePermissions(user);
  if (!granted.has(permission)) {
    return {
      error: NextResponse.json(
        { error: "Tu cuenta no tiene permiso para esta acción." },
        { status: 403 },
      ),
    };
  }
  return { user };
}
