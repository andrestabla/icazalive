import Dashboard from "./dashboard-client";
import { requirePageUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requirePageUser();
  return (
    <Dashboard
      user={user}
      initialData={await getDashboardSummary()}
    />
  );
}
