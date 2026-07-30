import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePageUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ParticipantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();
  if (user.role === "participant") redirect("/");
  return (
    <main className="app-shell">
      <AdminSidebar user={user} active="Participantes" />
      <section className="workspace module-workspace">{children}</section>
    </main>
  );
}
