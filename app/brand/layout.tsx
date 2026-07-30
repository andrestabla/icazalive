import { redirect } from "next/navigation";
import AdminSidebar from "@/app/components/admin-sidebar";
import { requirePageUser } from "@/lib/auth";

export default async function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();
  if (user.role === "participant") redirect("/");

  return (
    <main className="app-shell">
      <AdminSidebar user={user} active="Marca" />
      <section className="workspace module-workspace">{children}</section>
    </main>
  );
}
