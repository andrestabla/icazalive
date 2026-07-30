import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "pending_configuration",
      message:
        "El callback SSO está reservado. La autenticación federada se habilitará al conectar y validar el proveedor OIDC o SAML.",
    },
    {
      status: 501,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
