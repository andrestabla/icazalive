import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createSession, setSessionCookie } from "@/lib/auth";
import {
  decryptClientSecret,
  exchangeCode,
  isSsoUsable,
  readGoogleSso,
  ssoRedirectUri,
} from "@/lib/google-sso";
import { SSO_STATE_COOKIE } from "@/app/api/auth/sso/google/start/route";

export const runtime = "nodejs";

function fail(request: Request, code: string) {
  return NextResponse.redirect(new URL(`/login?sso_error=${code}`, request.url));
}

// Retorno de Google: valida state, canjea el código, comprueba el correo y
// abre sesión reutilizando la maquinaria de sesión existente.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state) {
    return fail(request, "cancelled");
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(SSO_STATE_COOKIE)?.value;
  cookieStore.set(SSO_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  if (!savedState || savedState !== state) {
    return fail(request, "state");
  }

  const row = await readGoogleSso().catch(() => null);
  if (!isSsoUsable(row)) return fail(request, "disabled");
  const secret = decryptClientSecret(row);
  if (!secret) return fail(request, "config");

  const result = await exchangeCode({
    code,
    clientId: row.clientId!,
    clientSecret: secret,
    redirectUri: ssoRedirectUri(request),
  });
  if (!result.ok) return fail(request, "exchange");

  const { email, emailVerified, name, hostedDomain } = result.identity;
  if (!emailVerified) return fail(request, "unverified");

  // Restricción por dominio (si se configuró).
  if (row.allowedDomain) {
    const domain = email.split("@")[1] ?? "";
    if (domain !== row.allowedDomain && hostedDomain !== row.allowedDomain) {
      return fail(request, "domain");
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
    if (!row.autoProvision) return fail(request, "no_account");
    // Primer ingreso: crea la cuenta de personal con el rol configurado.
    [account] = await db
      .insert(users)
      .values({ email, name: name ?? email, role: row.provisionRole, active: true })
      .returning();
  }

  if (!account.active) return fail(request, "inactive");

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
