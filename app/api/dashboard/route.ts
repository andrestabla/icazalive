import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/dashboard";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role === "participant") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  return NextResponse.json(
    { data: await getDashboardSummary() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
