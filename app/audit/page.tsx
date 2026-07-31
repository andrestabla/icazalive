import { getAuditEntries } from "@/lib/audit";
import AuditLogClient from "./audit-log-client";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  // El acceso lo controla el layout mediante el permiso audit.view.
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
