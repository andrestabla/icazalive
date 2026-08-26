import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "managed_by_replit",
      message:
        "La autorización de Zoom se administra de forma segura mediante la conexión de Replit.",
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
