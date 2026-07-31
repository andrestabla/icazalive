import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePermission } from "@/lib/page-guards";

export default async function PermissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, granted } = await requirePermission("permissions.manage");
  return (
    <main className="app-shell">
      <AdminSidebar user={user} granted={Array.from(granted)} active="Permisos" />
      <section className="workspace module-workspace">{children}</section>
    </main>
  );
}
