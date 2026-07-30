import { NextResponse } from "next/server";
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

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Clear-Site-Data": '"cache"',
    },
  });
}
