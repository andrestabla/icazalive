import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { outboundEmailSettings } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/email-crypto";
import {
  isOutboundProvider,
  outboundProviderLabels,
  readEmailSettings,
  resolveActiveOutbound,
  type OutboundProvider,
} from "@/lib/email-settings";
import { renderBrandedEmail } from "@/lib/email-branding";
import { getBrandSettings } from "@/lib/brand";
import { sendWithSendgrid, verifySendgridAccess } from "@/lib/sendgrid-sender";
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

// Nunca se devuelven la contraseña ni la clave de API; solo si ya hay una guardada.
function safeView(row: Awaited<ReturnType<typeof readEmailSettings>>) {
  if (!row) {
    return {
      provider: "smtp" as OutboundProvider,
      enabled: false,
      fromName: null,
      fromEmail: null,
      replyTo: null,
      smtpHost: null,
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: null,
      hasPassword: false,
      hasSendgridKey: false,
      region: "us-east-1",
      configurationSet: null,
      lastTestedAt: null,
      lastTestOk: null,
    };
  }
  return {
    provider: (isOutboundProvider(row.provider) ? row.provider : "smtp") as OutboundProvider,
    enabled: row.enabled,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyTo: row.replyTo,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUsername: row.smtpUsername,
    hasPassword: Boolean(row.smtpPasswordEncrypted),
    hasSendgridKey: Boolean(row.sendgridApiKeyEncrypted),
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
  action?: "save" | "test" | "check";
  provider?: OutboundProvider;
  enabled?: boolean;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  sendgridApiKey?: string | null;
  region?: string | null;
  configurationSet?: string | null;
  testRecipient?: string;
};

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.provider !== undefined && !isOutboundProvider(body.provider)) {
    return NextResponse.json({ error: "El proveedor de correo no es válido." }, { status: 400 });
  }
  const db = getDb();
  const existing = await readEmailSettings();

  const clean = (value: unknown, max = 320) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

  const provider: OutboundProvider =
    body.provider ?? (isOutboundProvider(existing?.provider) ? existing.provider : "smtp");
  const providerLabel = outboundProviderLabels[provider];

  const values = {
    id: "default",
    provider,
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
    // Los secretos solo se reemplazan si llega uno nuevo no vacío.
    smtpPasswordEncrypted:
      typeof body.smtpPassword === "string" && body.smtpPassword.trim()
        ? encryptSecret(body.smtpPassword.trim())
        : existing?.smtpPasswordEncrypted ?? null,
    sendgridApiKeyEncrypted:
      typeof body.sendgridApiKey === "string" && body.sendgridApiKey.trim()
        ? encryptSecret(body.sendgridApiKey.trim())
        : existing?.sendgridApiKeyEncrypted ?? null,
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

  // Verificación sin envío (SendGrid): permisos de la clave y dominio autenticado.
  if (body.action === "check") {
    if (provider !== "sendgrid") {
      return NextResponse.json(
        { error: "La verificación sin envío solo está disponible para SendGrid. Usa \"Probar envío\" para SMTP." },
        { status: 400 },
      );
    }
    const apiKey = saved.sendgridApiKeyEncrypted ? decryptSecret(saved.sendgridApiKeyEncrypted) : null;
    if (!apiKey) {
      return NextResponse.json({ error: "Guarda primero la clave de API de SendGrid." }, { status: 409 });
    }
    const check = await verifySendgridAccess(apiKey, saved.fromEmail);
    await writeAuditLog({
      actor: auth.user,
      action: "email_settings.checked",
      resourceType: "email_settings",
      resourceId: "default",
      summary: check.ok ? "Conexión con SendGrid verificada." : "La verificación de SendGrid falló.",
      details: {
        provider,
        ok: check.ok,
        mailSend: check.mailSend,
        domainAuthenticated: check.domainAuthenticated,
      },
      request,
    });
    return NextResponse.json({
      data: { settings: safeView(saved), check },
    });
  }

  // Envío de prueba con la configuración recién guardada.
  if (body.action === "test") {
    const recipient = clean(body.testRecipient);
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return NextResponse.json({ error: "Indica un destinatario válido." }, { status: 400 });
    }
    const outbound = await resolveActiveOutbound(saved);
    if (!outbound) {
      return NextResponse.json(
        {
          error:
            provider === "sendgrid"
              ? "Completa la clave de API y el remitente, y habilita el envío."
              : "Completa host, puerto, usuario, contraseña y remitente, y habilita el envío.",
        },
        { status: 409 },
      );
    }
    const brand = await getBrandSettings().catch(() => null);
    const testBody = `Correo de prueba enviado desde la configuración de correo saliente (${providerLabel}) de Icaza Jammoul Live. Si lo estás leyendo, el envío funciona correctamente.`;
    const message = {
      to: recipient,
      subject: `Prueba de correo (${providerLabel}) — Icaza Jammoul Live`,
      body: testBody,
      html: renderBrandedEmail({ bodyText: testBody, brand }),
    };
    const result =
      outbound.kind === "sendgrid"
        ? await sendWithSendgrid(outbound.sendgrid, message)
        : await sendWithSmtp(outbound.smtp, message);
    await db
      .update(outboundEmailSettings)
      .set({ lastTestedAt: new Date(), lastTestOk: result.ok })
      .where(eq(outboundEmailSettings.id, "default"));
    await writeAuditLog({
      actor: auth.user,
      action: "email_settings.test",
      resourceType: "email_settings",
      resourceId: "default",
      summary: result.ok
        ? `Correo de prueba (${providerLabel}) enviado a ${recipient}.`
        : `Falló el correo de prueba (${providerLabel}) a ${recipient}.`,
      details: { recipient, provider, ok: result.ok },
      request,
    });
    return NextResponse.json({
      data: {
        settings: safeView(await readEmailSettings()),
        test: result.ok
          ? { ok: true, detail: `Correo enviado a ${recipient} mediante ${providerLabel}. Revisa la bandeja de entrada (y spam).` }
          : {
              ok: false,
              // Los mensajes de SendGrid ya nombran al proveedor y traen la acción a seguir.
              detail: outbound.kind === "sendgrid" ? result.error : `El servidor SMTP rechazó el envío: ${result.error}`,
            },
      },
    });
  }

  await writeAuditLog({
    actor: auth.user,
    action: "email_settings.saved",
    resourceType: "email_settings",
    resourceId: "default",
    summary: `Configuración de correo saliente actualizada (${providerLabel}${values.enabled ? ", envío habilitado" : ", envío deshabilitado"}).`,
    details: { provider, enabled: values.enabled },
    request,
  });
  return NextResponse.json({ data: { settings: safeView(saved) } });
}
