import { getPrivacyAdminData } from "@/lib/privacy";
import PrivacyManager from "./privacy-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacidad y datos — Icaza Jammoul Live",
};

export default async function PrivacyManagementPage() {
  const data = await getPrivacyAdminData();
  return (
    <PrivacyManager
      initialDocuments={data.documents.map((document) => ({
        ...document,
        publishedAt: document.publishedAt?.toISOString() ?? null,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      }))}
      initialRequests={data.requests.map((request) => ({
        ...request,
        dueAt: request.dueAt.toISOString(),
        consentAcceptedAt: request.consentAcceptedAt.toISOString(),
        retentionUntil: request.retentionUntil.toISOString(),
        completedAt: request.completedAt?.toISOString() ?? null,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      }))}
      initialConsents={data.consents.map((consent) => ({
        ...consent,
        acceptedAt: consent.acceptedAt.toISOString(),
      }))}
    />
  );
}
