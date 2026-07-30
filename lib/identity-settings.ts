import type { IntegrationRequirement } from "@/lib/integrations";

export type IdentityProtocol = "oidc" | "saml";
export type MfaPolicy = "optional" | "required_admins" | "required_all";
export type MfaMethod = "totp" | "webauthn" | "email";

export type SafeIdentitySettings = {
  providerName: string | null;
  protocol: IdentityProtocol;
  organizationDomain: string | null;
  issuerUrl: string | null;
  clientId: string | null;
  entityId: string | null;
  mfaPolicy: MfaPolicy;
  mfaMethod: MfaMethod;
  recoveryCodesRequired: boolean;
};

export function getIdentityEnvironment() {
  const appBaseUrl = (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  return {
    callbackUrl:
      process.env.SSO_REDIRECT_URI ??
      `${appBaseUrl}/api/auth/sso/callback`,
    oidcSecret: Boolean(process.env.SSO_CLIENT_SECRET),
    samlCertificate: Boolean(process.env.SSO_SAML_CERTIFICATE),
    authEncryptionKey: Boolean(process.env.AUTH_ENCRYPTION_KEY),
    mfaIssuer: process.env.MFA_ISSUER ?? "Icaza Live",
    webauthnRpId: process.env.WEBAUTHN_RP_ID ?? null,
    webauthnOrigin: process.env.WEBAUTHN_ORIGIN ?? null,
    emailFrom: process.env.EMAIL_FROM ?? null,
  };
}

export function evaluateIdentitySettings(record: SafeIdentitySettings) {
  const environment = getIdentityEnvironment();
  const protocolReady =
    record.protocol === "oidc"
      ? Boolean(record.issuerUrl && record.clientId)
      : Boolean(record.issuerUrl && record.entityId);
  const protocolSecretReady =
    record.protocol === "oidc"
      ? environment.oidcSecret
      : environment.samlCertificate;

  let mfaRuntimeReady = true;
  let mfaRuntimeLabel = `Emisor TOTP: ${environment.mfaIssuer}`;
  if (record.mfaMethod === "webauthn") {
    mfaRuntimeReady = Boolean(
      environment.webauthnRpId && environment.webauthnOrigin,
    );
    mfaRuntimeLabel = "WEBAUTHN_RP_ID y WEBAUTHN_ORIGIN";
  } else if (record.mfaMethod === "email") {
    mfaRuntimeReady = Boolean(environment.emailFrom);
    mfaRuntimeLabel = "EMAIL_FROM";
  }

  const requirements: IntegrationRequirement[] = [
    {
      key: "identity_provider",
      label: "Proveedor de identidad",
      ready: Boolean(record.providerName),
      source: "database",
    },
    {
      key: "identity_domain",
      label: "Dominio corporativo",
      ready: Boolean(record.organizationDomain),
      source: "database",
    },
    {
      key: "identity_protocol",
      label:
        record.protocol === "oidc"
          ? "Issuer y Client ID de OIDC"
          : "Metadata y Entity ID de SAML",
      ready: protocolReady,
      source: "database",
    },
    {
      key: "identity_secret",
      label:
        record.protocol === "oidc"
          ? "SSO_CLIENT_SECRET"
          : "SSO_SAML_CERTIFICATE",
      ready: protocolSecretReady,
      source: "server",
    },
    {
      key: "auth_encryption",
      label: "AUTH_ENCRYPTION_KEY",
      ready: environment.authEncryptionKey,
      source: "server",
    },
    {
      key: "mfa_runtime",
      label: mfaRuntimeLabel,
      ready: mfaRuntimeReady,
      source:
        record.mfaMethod === "totp" ? "database" : "server",
    },
  ];

  return {
    requirements,
    ready: requirements.every((requirement) => requirement.ready),
    completed: requirements.filter((requirement) => requirement.ready).length,
    total: requirements.length,
    runtime: {
      callbackUrl: environment.callbackUrl,
      protocol: record.protocol,
      mfaMethod: record.mfaMethod,
    },
  };
}
