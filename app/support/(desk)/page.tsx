import { requirePermission } from "@/lib/page-guards";
import SupportDesk from "./support-desk";
import "./support.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Soporte — Icaza Jammoul Live",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, granted } = await requirePermission("support.view");
  const params = await searchParams;
  const initialCase = typeof params.case === "string" ? params.case : null;
  return (
    <SupportDesk
      currentUserId={user.id}
      canManage={granted.has("support.manage")}
      initialCase={initialCase}
    />
  );
}
