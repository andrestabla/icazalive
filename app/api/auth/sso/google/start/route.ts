import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  isSsoUsable,
  readGoogleSso,
  ssoRedirectUri,
} from "@/lib/google-sso";

export const runtime = "nodejs";

export const SSO_STATE_COOKIE = "icaza_sso_state";

// Inicia el flujo: guarda un state anti-CSRF en cookie y redirige a Google.
export async function GET(request: Request) {
  const row = await readGoogleSso().catch(() => null);
  if (!isSsoUsable(row)) {
    return NextResponse.redirect(new URL("/login?sso_error=disabled", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(SSO_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = buildAuthorizeUrl({
    clientId: row.clientId!,
    redirectUri: ssoRedirectUri(request),
    state,
    allowedDomain: row.allowedDomain,
  });
  return NextResponse.redirect(url);
}
