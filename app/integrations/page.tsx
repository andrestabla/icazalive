import { count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  events,
  identitySettings,
  integrationConnections,
  sessions,
} from "@/db/schema";
import { requirePageUser } from "@/lib/auth";
import { evaluateIdentitySettings } from "@/lib/identity-settings";
import {
  evaluateIntegration,
  type ManagedIntegrationProvider,
} from "@/lib/integrations";
import IntegrationsClient from "./integrations-client";

export const dynamic = "force-dynamic";

const providers: ManagedIntegrationProvider[] = [
  "zoom",
  "amazon_ivs",
  "amazon_s3",
  "email",
];

export default async function IntegrationsPage() {
  const db = getDb();
  const user = await requirePageUser();
  const [records, identityRecords, eventCount, readySessionCount] = await Promise.all([
    db
      .select()
      .from(integrationConnections)
      .where(inArray(integrationConnections.provider, providers)),
    db.select().from(identitySettings).limit(1),
    db.select({ total: count() }).from(events),
    db
      .select({ total: count() })
      .from(sessions)
      .where(eq(sessions.streamingStatus, "ready")),
  ]);
  const connections = providers
    .map((provider) => {
      const stored = records.find((record) => record.provider === provider);
      return stored ?? {
        id: `pending-${provider}`,
        provider,
        status: "disconnected" as const,
        accountLabel: null,
        externalAccountId: null,
        region: provider === "zoom" ? null : process.env.AWS_REGION ?? "us-east-1",
        lastCheckedAt: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
    })
    .map((record) => ({
      connection: {
        ...record,
        provider: record.provider as ManagedIntegrationProvider,
        lastCheckedAt: record.lastCheckedAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      },
      evaluation: evaluateIntegration({
        provider: record.provider as ManagedIntegrationProvider,
        accountLabel: record.accountLabel,
        externalAccountId: record.externalAccountId,
        region: record.region,
      }),
    }));
  const identityRecord = identityRecords[0];
  const safeIdentitySettings = identityRecord ?? {
    providerName: null,
    protocol: "oidc" as const,
    organizationDomain: null,
    issuerUrl: null,
    clientId: null,
    entityId: null,
    mfaPolicy: "required_admins" as const,
    mfaMethod: "totp" as const,
    recoveryCodesRequired: true,
  };

  return (
    <IntegrationsClient
      initialConnections={connections}
      initialIdentity={{
        settings: identityRecord
          ? {
              ...identityRecord,
              lastCheckedAt: identityRecord.lastCheckedAt?.toISOString() ?? null,
              createdAt: identityRecord.createdAt.toISOString(),
              updatedAt: identityRecord.updatedAt.toISOString(),
            }
          : {
              ...safeIdentitySettings,
              id: "default",
              status: "pending",
              lastCheckedAt: null,
              createdAt: new Date(0).toISOString(),
              updatedAt: new Date(0).toISOString(),
            },
        evaluation: evaluateIdentitySettings(safeIdentitySettings),
      }}
      canManageIdentity={user.role === "administrator"}
      eventCount={eventCount[0]?.total ?? 0}
      readySessionCount={readySessionCount[0]?.total ?? 0}
    />
  );
}
