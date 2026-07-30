import { redirect } from "next/navigation";
import { getAuditEntries } from "@/lib/audit";
import { requirePageUser } from "@/lib/auth";
import AuditLogClient from "./audit-log-client";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requirePageUser();
  if (user.role !== "administrator") redirect("/");

  const result = await getAuditEntries({ limit: 100 });
  return (
    <AuditLogClient
      initialData={{
        ...result,
        entries: result.entries.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
        })),
      }}
    />
  );
}
