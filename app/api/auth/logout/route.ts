import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/public-origin";
import { writeAuditLog } from "@/lib/audit";
import {
  clearSessionCookie,
  deleteCurrentSession,
  getCurrentUser,
} from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  await deleteCurrentSession();
  await clearSessionCookie();
  if (user) {
    await writeAuditLog({
      actor: user,
      action: "auth.logout",
      resourceType: "authentication",
      resourceId: user.id,
      summary: "Sesión cerrada.",
      request,
    });
  }

  // Detrás del proxy request.url apunta al host interno (0.0.0.0:3000); el
  // origen público evita redirigir al participante a una URL inválida.
  return NextResponse.redirect(new URL("/login", getPublicOrigin(request)), {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Clear-Site-Data": '"cache"',
    },
  });
}
