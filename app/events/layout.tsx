import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePageUser } from "@/lib/auth";

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <main className="app-shell">
      <AdminSidebar user={user} active="Eventos" />
      <section className="workspace module-workspace">{children}</section>
    </main>
  );
}
