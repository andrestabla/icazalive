import Link from "next/link";
import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePageUser } from "@/lib/auth";
import {
  getEffectivePermissions,
  permissionCatalog,
  permissionLabel,
  type PermissionKey,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sin acceso — Icaza Jammoul Live" };

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ permiso?: string }>;
}) {
  const user = await requirePageUser();
  const { granted } = await getEffectivePermissions(user);
  const { permiso } = await searchParams;

  const requested = permiso as PermissionKey | undefined;
  const moduleLabel = requested
    ? permissionCatalog.find((module) =>
        module.permissions.some((permission) => permission.key === requested),
      )?.label
    : null;

  const availableModules = permissionCatalog.filter((module) =>
    module.permissions.some((permission) => granted.has(permission.key)),
  );

  return (
    <main className="app-shell">
      <AdminSidebar user={user} granted={Array.from(granted)} active="Resumen" />
      <section className="workspace module-workspace">
        <div className="access-denied">
          <span>⊘</span>
          <p className="eyebrow">ACCESO RESTRINGIDO</p>
          <h1>{moduleLabel ? `No tienes acceso a ${moduleLabel}` : "No tienes acceso a este módulo"}</h1>
          <p>
            {requested
              ? `Tu cuenta no tiene el permiso “${permissionLabel(requested)}”.`
              : "Tu cuenta no cuenta con los permisos necesarios."}{" "}
            Si necesitas entrar, pídele a un administrador que lo habilite desde Permisos.
          </p>
          {availableModules.length > 0 && (
            <div className="access-denied-modules">
              <small>MÓDULOS DISPONIBLES PARA TI</small>
              <div>
                {availableModules.map((module) => (
                  <Link href={module.path} key={module.module}>
                    {module.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
