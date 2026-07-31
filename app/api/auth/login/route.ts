import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { mfaBackupCodes, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createSession, safeReturnPath, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { verifyTotp } from "@/lib/totp";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    returnTo?: string;
    totpCode?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || password.length < 8 || password.length > 128) {
    await writeAuditLog({
      actorEmail: email ?? null,
      action: "auth.login.failed",
      resourceType: "authentication",
      outcome: "failure",
      summary: "Intento de acceso con credenciales no válidas.",
      request,
    });
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos." },
      { status: 401 },
    );
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user?.active || !user.passwordHash) {
    await writeAuditLog({
      actorEmail: email,
      action: "auth.login.denied",
      resourceType: "authentication",
      resourceId: user?.id,
      outcome: "denied",
      summary: "Acceso rechazado para una cuenta inexistente o inactiva.",
      request,
    });
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos." },
      { status: 401 },
    );
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await writeAuditLog({
      actorEmail: email,
      action: "auth.login.blocked",
      resourceType: "authentication",
      resourceId: user.id,
      outcome: "denied",
      summary: "Acceso rechazado porque la cuenta está bloqueada.",
      details: { lockedUntil: user.lockedUntil.toISOString() },
      request,
    });
    return NextResponse.json(
      { error: "Acceso temporalmente bloqueado. Intenta nuevamente más tarde." },
      { status: 429 },
    );
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    const attempts = user.failedLoginAttempts + 1;
    await db
      .update(users)
      .set({
        failedLoginAttempts: attempts >= 5 ? 0 : attempts,
        lockedUntil:
          attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await writeAuditLog({
      actorEmail: email,
      action: "auth.login.failed",
      resourceType: "authentication",
      resourceId: user.id,
      outcome: "failure",
      summary: "Contraseña incorrecta.",
      details: { attemptsBeforeReset: attempts },
      request,
    });
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos." },
      { status: 401 },
    );
  }

  // Segundo factor: si está activo, exige un código TOTP o de respaldo.
  if (user.mfaEnabled && user.mfaSecret) {
    if (!body.totpCode) {
      return NextResponse.json(
        { data: { mfaRequired: true } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    let secondFactorOk = verifyTotp(user.mfaSecret, body.totpCode);
    if (!secondFactorOk) {
      const backupHash = createHash("sha256")
        .update(body.totpCode.replace(/\s+/g, "").toUpperCase())
        .digest("hex");
      const [backup] = await db
        .select({ id: mfaBackupCodes.id })
        .from(mfaBackupCodes)
        .where(
          and(
            eq(mfaBackupCodes.userId, user.id),
            eq(mfaBackupCodes.codeHash, backupHash),
            isNull(mfaBackupCodes.usedAt),
          ),
        )
        .limit(1);
      if (backup) {
        secondFactorOk = true;
        await db
          .update(mfaBackupCodes)
          .set({ usedAt: new Date() })
          .where(eq(mfaBackupCodes.id, backup.id));
      }
    }
    if (!secondFactorOk) {
      await writeAuditLog({
        actorEmail: email,
        action: "auth.login.mfa_failed",
        resourceType: "authentication",
        resourceId: user.id,
        outcome: "denied",
        summary: "Código de segundo factor incorrecto.",
        request,
      });
      return NextResponse.json(
        { error: "El código de verificación no es válido.", mfaRequired: true },
        { status: 401 },
      );
    }
  }

  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  const session = await createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);
  await writeAuditLog({
    actor: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    action: "auth.login.succeeded",
    resourceType: "authentication",
    resourceId: user.id,
    summary: "Inicio de sesión correcto.",
    request,
  });

  return NextResponse.json(
    {
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        returnTo: safeReturnPath(body.returnTo),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
