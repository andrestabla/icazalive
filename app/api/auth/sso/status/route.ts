import { NextResponse } from "next/server";
import { isSsoUsable, readGoogleSso } from "@/lib/google-sso";

export const runtime = "nodejs";

// Público: la página de login pregunta si mostrar el botón de Google.
export async function GET() {
  const row = await readGoogleSso().catch(() => null);
  return NextResponse.json(
    { data: { enabled: isSsoUsable(row) } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
