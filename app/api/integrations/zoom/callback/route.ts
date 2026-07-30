import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "pending_configuration",
      message:
        "El callback de Zoom está reservado. La autorización real se habilitará al conectar la app OAuth y su almacenamiento cifrado de tokens.",
    },
    {
      status: 501,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
