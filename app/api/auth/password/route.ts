import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { authSessions, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  isValidPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/password-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (
    !currentPassword ||
    currentPassword.length > PASSWORD_MAX_LENGTH ||
    !isValidPassword(newPassword)
  ) {
    return NextResponse.json(
      { error: PASSWORD_POLICY_MESSAGE },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser distinta de la actual." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [record] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!record?.passwordHash) {
    return NextResponse.json(
      { error: "La cuenta no admite cambio de contraseña local." },
      { status: 400 },
    );
  }

  const validCurrent = await verifyPassword(
    currentPassword,
    record.passwordHash,
  );
  if (!validCurrent) {
    await writeAuditLog({
      actor: user,
      action: "auth.password.change_failed",
      resourceType: "authentication",
      resourceId: user.id,
      outcome: "denied",
      summary: "Cambio de contraseña rechazado: contraseña actual incorrecta.",
      request,
    });
    return NextResponse.json(
      { error: "La contraseña actual no es correcta." },
      { status: 403 },
    );
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Cierra las demás sesiones del usuario y conserva la actual.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db
      .delete(authSessions)
      .where(
        and(
          eq(authSessions.userId, user.id),
          ne(authSessions.tokenHash, tokenHash),
        ),
      );
  }

  await writeAuditLog({
    actor: user,
    action: "auth.password.changed",
    resourceType: "authentication",
    resourceId: user.id,
    summary: "El usuario cambió su contraseña.",
    request,
  });

  return NextResponse.json({
    data: { changed: true },
  });
}
