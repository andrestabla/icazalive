import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/public-origin";
import {
  SSO_INTENT_COOKIE,
  SSO_STATE_COOKIE,
  buildAuthorizeUrl,
  decodeIntent,
  encodeIntent,
  isSsoUsable,
  readGoogleSso,
  ssoRedirectUri,
  type SsoIntent,
} from "@/lib/google-sso";

export const runtime = "nodejs";

export { SSO_STATE_COOKIE };

// Inicia el flujo: guarda un state anti-CSRF en cookie y redirige a Google.
// Con ?intent=prefill&slug=<evento> el retorno no abre sesión: solo devuelve
// nombre y correo al formulario público de registro de ese evento.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const intent: SsoIntent =
    url.searchParams.get("intent") === "prefill"
      ? decodeIntent(`prefill:${url.searchParams.get("slug") ?? ""}`)
      : { kind: "login" };

  const row = await readGoogleSso().catch(() => null);
  if (!isSsoUsable(row)) {
    const back =
      intent.kind === "prefill"
        ? `/register/${intent.slug}?sso_error=disabled`
        : "/login?sso_error=disabled";
    return NextResponse.redirect(new URL(back, getPublicOrigin(request)));
  }

  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  cookieStore.set(SSO_STATE_COOKIE, state, cookieOptions);
  cookieStore.set(SSO_INTENT_COOKIE, encodeIntent(intent), cookieOptions);

  const authorizeUrl = buildAuthorizeUrl({
    clientId: row.clientId!,
    redirectUri: ssoRedirectUri(request),
    state,
    // La restricción de dominio aplica al personal, no a los asistentes.
    allowedDomain: intent.kind === "prefill" ? null : row.allowedDomain,
  });
  return NextResponse.redirect(authorizeUrl);
}
