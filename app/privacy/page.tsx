import { getCurrentUser } from "@/lib/auth";
import { getBrandSettings } from "@/lib/brand";
import { getPublishedLegalDocuments } from "@/lib/privacy";
import PrivacyCenterClient from "./privacy-center-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacidad — Icaza Live",
};

export default async function PrivacyPage() {
  const [brand, viewer, documents] = await Promise.all([
    getBrandSettings(),
    getCurrentUser(),
    getPublishedLegalDocuments(),
  ]);
  return (
    <PrivacyCenterClient
      brand={brand}
      viewer={viewer}
      documents={{
        privacy: {
          ...documents.privacy,
          publishedAt: documents.privacy.publishedAt?.toISOString() ?? null,
        },
        terms: {
          ...documents.terms,
          publishedAt: documents.terms.publishedAt?.toISOString() ?? null,
        },
      }}
      privacyEmail={
        process.env.PRIVACY_EMAIL ??
        process.env.SUPPORT_EMAIL ??
        "privacidad@icazalive.local"
      }
    />
  );
}
