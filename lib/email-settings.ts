import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { outboundEmailSettings, type OutboundEmailSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/email-crypto";

// Proveedores de correo saliente configurables desde Integraciones. La fila
// "default" guarda ambos juegos de credenciales cifrados; `provider` decide cuál
// se usa cuando el envío está habilitado.
export type OutboundProvider = "smtp" | "sendgrid";

export const outboundProviderLabels: Record<OutboundProvider, string> = {
  smtp: "Servidor SMTP",
  sendgrid: "SendGrid",
};

export function isOutboundProvider(value: unknown): value is OutboundProvider {
  return value === "smtp" || value === "sendgrid";
}

export type ResolvedSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string | null;
  fromEmail: string;
  replyTo: string | null;
};

export type ResolvedSendgridConfig = {
  apiKey: string;
  fromName: string | null;
  fromEmail: string;
  replyTo: string | null;
};

export type ResolvedOutbound =
  | { kind: "smtp"; smtp: ResolvedSmtpConfig }
  | { kind: "sendgrid"; sendgrid: ResolvedSendgridConfig };

// Lee la fila de configuración (siempre id "default").
export async function readEmailSettings(): Promise<OutboundEmailSettings | null> {
  const [row] = await getDb()
    .select()
    .from(outboundEmailSettings)
    .where(eq(outboundEmailSettings.id, "default"))
    .limit(1);
  return row ?? null;
}

// Devuelve la configuración SMTP lista para enviar solo si está habilitada y
// completa (con contraseña descifrable). Si falta algo, retorna null y el
// proveedor cae a SES-API o al buzón local.
export async function resolveActiveSmtp(
  settings?: OutboundEmailSettings | null,
): Promise<ResolvedSmtpConfig | null> {
  const row = settings ?? (await readEmailSettings());
  if (!row || !row.enabled || row.provider !== "smtp") return null;
  if (
    !row.smtpHost ||
    !row.smtpPort ||
    !row.smtpUsername ||
    !row.smtpPasswordEncrypted ||
    !row.fromEmail
  ) {
    return null;
  }
  const password = decryptSecret(row.smtpPasswordEncrypted);
  if (!password) return null;
  return {
    host: row.smtpHost,
    port: row.smtpPort,
    secure: row.smtpSecure,
    username: row.smtpUsername,
    password,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyTo: row.replyTo,
  };
}

// Igual que resolveActiveSmtp, para SendGrid: requiere clave de API descifrable
// y remitente. La clave vive solo cifrada en la base.
export async function resolveActiveSendgrid(
  settings?: OutboundEmailSettings | null,
): Promise<ResolvedSendgridConfig | null> {
  const row = settings ?? (await readEmailSettings());
  if (!row || !row.enabled || row.provider !== "sendgrid") return null;
  if (!row.sendgridApiKeyEncrypted || !row.fromEmail) return null;
  const apiKey = decryptSecret(row.sendgridApiKeyEncrypted);
  if (!apiKey) return null;
  return {
    apiKey,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyTo: row.replyTo,
  };
}

// Proveedor activo configurado desde la UI, o null para caer a las variables
// de entorno (SES / Resend / buzón local).
export async function resolveActiveOutbound(
  settings?: OutboundEmailSettings | null,
): Promise<ResolvedOutbound | null> {
  const row = settings ?? (await readEmailSettings());
  if (!row || !row.enabled) return null;
  if (row.provider === "sendgrid") {
    const sendgrid = await resolveActiveSendgrid(row);
    return sendgrid ? { kind: "sendgrid", sendgrid } : null;
  }
  const smtp = await resolveActiveSmtp(row);
  return smtp ? { kind: "smtp", smtp } : null;
}
