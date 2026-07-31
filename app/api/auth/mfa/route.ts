import { and, count, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getDb } from "@/db";
import { mfaBackupCodes, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import {
  generateBackupCodes,
  generateTotpSecret,
  otpauthUrl,
  verifyTotp,
} from "@/lib/totp";

export const runtime = "nodejs";

function hashBackupCode(code: string): string {
  return createHash("sha256")
    .update(code.replace(/\s+/g, "").toUpperCase())
    .digest("hex");
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const db = getDb();
  const [record] = await db
    .select({ mfaEnabled: users.mfaEnabled, mfaEnrolledAt: users.mfaEnrolledAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const [codes] = await db
    .select({ total: count() })
    .from(mfaBackupCodes)
    .where(and(eq(mfaBackupCodes.userId, user.id), isNull(mfaBackupCodes.usedAt)));
  return NextResponse.json({
    data: {
      enabled: record?.mfaEnabled ?? false,
      enrolledAt: record?.mfaEnrolledAt ?? null,
      backupCodesRemaining: codes?.total ?? 0,
    },
  });
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const body = (await request.json()) as {
    action?: "start" | "activate" | "disable";
    code?: string;
  };
  const db = getDb();
  const [record] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!record) {
    return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
  }

  if (body.action === "start") {
    if (record.mfaEnabled) {
      return NextResponse.json(
        { error: "El segundo factor ya está activo." },
        { status: 409 },
      );
    }
    const secret = generateTotpSecret();
    await db
      .update(users)
      .set({ mfaSecret: secret, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return NextResponse.json({
      data: { secret, otpauth: otpauthUrl(user.email, secret) },
    });
  }

  if (body.action === "activate") {
    if (record.mfaEnabled || !record.mfaSecret) {
      return NextResponse.json(
        { error: "Inicia la configuración antes de activar." },
        { status: 409 },
      );
    }
    if (!body.code || !verifyTotp(record.mfaSecret, body.code)) {
      return NextResponse.json(
        { error: "El código no coincide. Verifica la app autenticadora." },
        { status: 400 },
      );
    }
    const backupCodes = generateBackupCodes();
    await db.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ mfaEnabled: true, mfaEnrolledAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await transaction
        .delete(mfaBackupCodes)
        .where(eq(mfaBackupCodes.userId, user.id));
      await transaction.insert(mfaBackupCodes).values(
        backupCodes.map((code) => ({ userId: user.id, codeHash: hashBackupCode(code) })),
      );
    });
    await writeAuditLog({
      actor: user,
      action: "auth.mfa.enabled",
      resourceType: "authentication",
      resourceId: user.id,
      summary: "Segundo factor TOTP activado.",
      request,
    });
    return NextResponse.json({ data: { enabled: true, backupCodes } });
  }

  if (body.action === "disable") {
    if (!record.mfaEnabled || !record.mfaSecret) {
      return NextResponse.json(
        { error: "El segundo factor no está activo." },
        { status: 409 },
      );
    }
    const validTotp = body.code ? verifyTotp(record.mfaSecret, body.code) : false;
    let validBackup = false;
    if (!validTotp && body.code) {
      const [match] = await db
        .select({ id: mfaBackupCodes.id })
        .from(mfaBackupCodes)
        .where(
          and(
            eq(mfaBackupCodes.userId, user.id),
            eq(mfaBackupCodes.codeHash, hashBackupCode(body.code)),
            isNull(mfaBackupCodes.usedAt),
          ),
        )
        .limit(1);
      validBackup = Boolean(match);
    }
    if (!validTotp && !validBackup) {
      return NextResponse.json(
        { error: "Confirma con un código válido de la app o de respaldo." },
        { status: 400 },
      );
    }
    await db.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({
          mfaEnabled: false,
          mfaSecret: null,
          mfaEnrolledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      await transaction
        .delete(mfaBackupCodes)
        .where(eq(mfaBackupCodes.userId, user.id));
    });
    await writeAuditLog({
      actor: user,
      action: "auth.mfa.disabled",
      resourceType: "authentication",
      resourceId: user.id,
      summary: "Segundo factor TOTP desactivado.",
      request,
    });
    return NextResponse.json({ data: { enabled: false } });
  }

  return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
}
