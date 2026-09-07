import { redirect } from "next/navigation";
import Dashboard from "./dashboard-client";
import { requirePageUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";
import { getEffectivePermissions, permissionCatalog } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requirePageUser();
  const { granted } = await getEffectivePermissions(user);

  // Sin acceso al resumen se envía al primer módulo disponible; si no hay
  // ninguno, a la pantalla explicativa.
  if (!granted.has("dashboard.view")) {
    const fallback = permissionCatalog.find(
      (module) =>
        module.module !== "dashboard" &&
        module.permissions.some((permission) => granted.has(permission.key)),
    );
    redirect(fallback ? fallback.path : "/sin-acceso?permiso=dashboard.view");
  }

  return (
    <Dashboard
      user={user}
      granted={Array.from(granted)}
      initialData={await getDashboardSummary()}
    />
  );
}
