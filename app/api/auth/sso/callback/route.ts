import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createSession, setSessionCookie } from "@/lib/auth";
import {
  REGISTRATION_PREFILL_COOKIE,
  SSO_INTENT_COOKIE,
  SSO_STATE_COOKIE,
  decodeIntent,
  decryptClientSecret,
  encodePrefill,
  exchangeCode,
  isSsoUsable,
  readGoogleSso,
  ssoRedirectUri,
  type SsoIntent,
} from "@/lib/google-sso";

export const runtime = "nodejs";

function fail(request: Request, intent: SsoIntent, code: string) {
  const back =
    intent.kind === "prefill"
      ? `/register/${intent.slug}?sso_error=${code}`
      : `/login?sso_error=${code}`;
  return NextResponse.redirect(new URL(back, request.url));
}

// Retorno de Google: valida state, canjea el código, comprueba el correo y
// abre sesión (personal) o devuelve los datos al registro público (prefill).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get(SSO_STATE_COOKIE)?.value;
  const intent = decodeIntent(cookieStore.get(SSO_INTENT_COOKIE)?.value);
  cookieStore.set(SSO_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  cookieStore.set(SSO_INTENT_COOKIE, "", { path: "/", maxAge: 0 });

  if (url.searchParams.get("error") || !code || !state) {
    return fail(request, intent, "cancelled");
  }
  if (!savedState || savedState !== state) {
    return fail(request, intent, "state");
  }

  const row = await readGoogleSso().catch(() => null);
  if (!isSsoUsable(row)) return fail(request, intent, "disabled");
  const secret = decryptClientSecret(row);
  if (!secret) return fail(request, intent, "config");

  const result = await exchangeCode({
    code,
    clientId: row.clientId!,
    clientSecret: secret,
    redirectUri: ssoRedirectUri(request),
  });
  if (!result.ok) return fail(request, intent, "exchange");

  const { email, emailVerified, name, hostedDomain } = result.identity;
  if (!emailVerified) return fail(request, intent, "unverified");

  // Prefill del registro público: sin sesión, sin cuenta, sin filtro de dominio.
  if (intent.kind === "prefill") {
    cookieStore.set(
      REGISTRATION_PREFILL_COOKIE,
      encodePrefill({ slug: intent.slug, name: name ?? "", email }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: `/register/${intent.slug}`,
        maxAge: 300,
      },
    );
    return NextResponse.redirect(
      new URL(`/register/${intent.slug}?google=1`, request.url),
    );
  }

  // Restricción por dominio (si se configuró).
  if (row.allowedDomain) {
    const domain = email.split("@")[1] ?? "";
    if (domain !== row.allowedDomain && hostedDomain !== row.allowedDomain) {
      return fail(request, intent, "domain");
    }
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let account = existing;
  if (!account) {
    if (!row.autoProvision) return fail(request, intent, "no_account");
    // Primer ingreso: crea la cuenta con el rol configurado.
    [account] = await db
      .insert(users)
      .values({ email, name: name ?? email, role: row.provisionRole, active: true })
      .returning();
  }

  if (!account.active) return fail(request, intent, "inactive");

  const session = await createSession(account.id);
  await setSessionCookie(session.token, session.expiresAt);
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, account.id));

  await writeAuditLog({
    actor: { id: account.id, email: account.email, name: account.name, role: account.role },
    action: "auth.sso.login",
    resourceType: "user",
    resourceId: account.id,
    summary: `Inicio de sesión con Google (${email}).`,
    request,
  });

  // El personal entra al panel; los asistentes van al Centro de ayuda.
  const destination = account.role === "participant" ? "/help" : "/";
  return NextResponse.redirect(new URL(destination, request.url));
}
