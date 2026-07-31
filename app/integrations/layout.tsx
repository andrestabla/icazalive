import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePermission } from "@/lib/page-guards";

export default async function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, granted } = await requirePermission("integrations.view");
  return (
    <main className="app-shell">
      <AdminSidebar user={user} granted={Array.from(granted)} active="Integraciones" />
      <section className="workspace module-workspace">{children}</section>
    </main>
  );
}
