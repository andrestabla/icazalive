import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePermission } from "@/lib/page-guards";

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const { user, granted } = await requirePermission("support.view");
  return (
    <main className="app-shell">
      <AdminSidebar user={user} granted={Array.from(granted)} active="Soporte" />
      <section className="workspace module-workspace">{children}</section>
    </main>
  );
}
