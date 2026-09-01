import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { googleSsoSettings, type GoogleSsoSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/email-crypto";

// Endpoints OIDC de Google (well-known, estables).
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export function ssoRedirectUri(request: Request): string {
  const base = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (base) return `${base}/api/auth/sso/callback`;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin = forwardedHost
    ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${forwardedHost}`
    : new URL(request.url).origin;
  return `${origin}/api/auth/sso/callback`;
}

export async function readGoogleSso(): Promise<GoogleSsoSettings | null> {
  const [row] = await getDb()
    .select()
    .from(googleSsoSettings)
    .where(eq(googleSsoSettings.id, "default"))
    .limit(1);
  return row ?? null;
}

export function isSsoUsable(row: GoogleSsoSettings | null): row is GoogleSsoSettings {
  return Boolean(row && row.enabled && row.clientId && row.clientSecretEncrypted);
}

// Construye la URL de consentimiento de Google.
export function buildAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  allowedDomain?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: options.state,
    access_type: "online",
    prompt: "select_account",
  });
  // Sugerencia de dominio (no es una garantía de seguridad; se revalida luego).
  if (options.allowedDomain) params.set("hd", options.allowedDomain);
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export type GoogleIdentity = {
  email: string;
  emailVerified: boolean;
  name: string | null;
  hostedDomain: string | null;
};

// Intercambia el código por tokens y extrae la identidad del id_token. El
// id_token llega directo del endpoint de Google por TLS, autenticado con el
// client secret, por lo que su contenido es de confianza sin re-verificar la
// firma JWKS.
export async function exchangeCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ ok: true; identity: GoogleIdentity } | { ok: false; error: string }> {
  try {
    const response = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: options.code,
        client_id: options.clientId,
        client_secret: options.clientSecret,
        redirect_uri: options.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `Google ${response.status}: ${detail.slice(0, 200)}` };
    }
    const payload = (await response.json()) as { id_token?: string };
    if (!payload.id_token) return { ok: false, error: "Google no devolvió id_token." };

    const claimsSegment = payload.id_token.split(".")[1];
    if (!claimsSegment) return { ok: false, error: "id_token con formato inválido." };
    const claims = JSON.parse(
      Buffer.from(claimsSegment, "base64url").toString("utf8"),
    ) as {
      email?: string;
      email_verified?: boolean | string;
      name?: string;
      hd?: string;
    };
    if (!claims.email) return { ok: false, error: "Google no entregó el correo." };

    return {
      ok: true,
      identity: {
        email: claims.email.toLowerCase(),
        emailVerified: claims.email_verified === true || claims.email_verified === "true",
        name: claims.name ?? null,
        hostedDomain: claims.hd ?? null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fallo de red con Google.",
    };
  }
}

export function decryptClientSecret(row: GoogleSsoSettings): string | null {
  return row.clientSecretEncrypted ? decryptSecret(row.clientSecretEncrypted) : null;
}
