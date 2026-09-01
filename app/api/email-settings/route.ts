import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { outboundEmailSettings } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/email-crypto";
import { readEmailSettings, resolveActiveSmtp } from "@/lib/email-settings";
import { renderBrandedEmail } from "@/lib/email-branding";
import { getBrandSettings } from "@/lib/brand";
import { sendWithSmtp } from "@/lib/smtp-sender";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (user.role !== "administrator") {
    return { error: NextResponse.json({ error: "Solo un administrador puede configurar el correo." }, { status: 403 }) };
  }
  return { user };
}

// Nunca se devuelve la contraseña; solo si ya hay una guardada.
function safeView(row: Awaited<ReturnType<typeof readEmailSettings>>) {
  if (!row) {
    return {
      provider: "smtp",
      enabled: false,
      fromName: null,
      fromEmail: null,
      replyTo: null,
      smtpHost: null,
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: null,
      hasPassword: false,
      region: "us-east-1",
      configurationSet: null,
      lastTestedAt: null,
      lastTestOk: null,
    };
  }
  return {
    provider: row.provider,
    enabled: row.enabled,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyTo: row.replyTo,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUsername: row.smtpUsername,
    hasPassword: Boolean(row.smtpPasswordEncrypted),
    region: row.region,
    configurationSet: row.configurationSet,
    lastTestedAt: row.lastTestedAt,
    lastTestOk: row.lastTestOk,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ data: safeView(await readEmailSettings()) });
}

type Body = {
  action?: "save" | "test";
  enabled?: boolean;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  region?: string | null;
  configurationSet?: string | null;
  testRecipient?: string;
};

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as Body;
  const db = getDb();
  const existing = await readEmailSettings();

  const clean = (value: unknown, max = 320) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

  const values = {
    id: "default",
    provider: "smtp",
    enabled: body.enabled ?? existing?.enabled ?? false,
    fromName: body.fromName !== undefined ? clean(body.fromName, 120) : existing?.fromName ?? null,
    fromEmail: body.fromEmail !== undefined ? clean(body.fromEmail) : existing?.fromEmail ?? null,
    replyTo: body.replyTo !== undefined ? clean(body.replyTo) : existing?.replyTo ?? null,
    smtpHost: body.smtpHost !== undefined ? clean(body.smtpHost) : existing?.smtpHost ?? null,
    smtpPort:
      body.smtpPort !== undefined && body.smtpPort !== null
        ? Math.min(65535, Math.max(1, Math.round(body.smtpPort)))
        : existing?.smtpPort ?? 587,
    smtpSecure: body.smtpSecure ?? existing?.smtpSecure ?? false,
    smtpUsername: body.smtpUsername !== undefined ? clean(body.smtpUsername) : existing?.smtpUsername ?? null,
    // Solo se reemplaza la contraseña si llega una nueva no vacía.
    smtpPasswordEncrypted:
      typeof body.smtpPassword === "string" && body.smtpPassword.trim()
        ? encryptSecret(body.smtpPassword.trim())
        : existing?.smtpPasswordEncrypted ?? null,
    region: body.region !== undefined ? clean(body.region, 40) : existing?.region ?? "us-east-1",
    configurationSet:
      body.configurationSet !== undefined ? clean(body.configurationSet, 120) : existing?.configurationSet ?? null,
    updatedBy: auth.user.id,
    updatedAt: new Date(),
  };

  const [saved] = await db
    .insert(outboundEmailSettings)
    .values(values)
    .onConflictDoUpdate({ target: outboundEmailSettings.id, set: values })
    .returning();

  // Envío de prueba con la configuración recién guardada.
  if (body.action === "test") {
    const recipient = clean(body.testRecipient);
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return NextResponse.json({ error: "Indica un destinatario válido." }, { status: 400 });
    }
    const smtp = await resolveActiveSmtp(saved);
    if (!smtp) {
      return NextResponse.json(
        { error: "Completa host, puerto, usuario, contraseña y remitente, y habilita el envío." },
        { status: 409 },
      );
    }
    const brand = await getBrandSettings().catch(() => null);
    const testBody = "Correo de prueba enviado desde la configuración SMTP de Icaza Live. Si lo estás leyendo, el envío por SMTP funciona correctamente.";
    const result = await sendWithSmtp(smtp, {
      to: recipient,
      subject: "Prueba de correo SMTP — Icaza Live",
      body: testBody,
      html: renderBrandedEmail({ bodyText: testBody, brand }),
    });
    await db
      .update(outboundEmailSettings)
      .set({ lastTestedAt: new Date(), lastTestOk: result.ok })
      .where(eq(outboundEmailSettings.id, "default"));
    await writeAuditLog({
      actor: auth.user,
      action: "email_settings.test",
      resourceType: "email_settings",
      resourceId: "default",
      summary: result.ok ? `Correo SMTP de prueba enviado a ${recipient}.` : `Falló el correo SMTP de prueba a ${recipient}.`,
      details: { recipient, ok: result.ok },
      request,
    });
    return NextResponse.json({
      data: {
        settings: safeView(await readEmailSettings()),
        test: result.ok
          ? { ok: true, detail: `Correo enviado a ${recipient}. Revisa la bandeja de entrada (y spam).` }
          : { ok: false, detail: `El servidor SMTP rechazó el envío: ${result.error}` },
      },
    });
  }

  await writeAuditLog({
    actor: auth.user,
    action: "email_settings.saved",
    resourceType: "email_settings",
    resourceId: "default",
    summary: "Configuración de correo saliente SMTP actualizada.",
    request,
  });
  return NextResponse.json({ data: { settings: safeView(saved) } });
}
