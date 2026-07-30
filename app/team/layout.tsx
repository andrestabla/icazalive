import { redirect } from "next/navigation";
import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePageUser } from "@/lib/auth";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();
  if (user.role !== "administrator") redirect("/");

  return (
    <main className="app-shell">
      <AdminSidebar user={user} active="Equipo" />
      <section className="workspace module-workspace">{children}</section>
    </main>
  );
}
