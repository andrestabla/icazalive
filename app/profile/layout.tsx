import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePageUser } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/permissions";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const { granted } = await getEffectivePermissions(user);
  return (
    <main className="app-shell">
      <AdminSidebar user={user} granted={Array.from(granted)} active="Perfil" />
      <section className="workspace module-workspace">{children}</section>
    </main>
  );
}
