import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { outboundEmailSettings, type OutboundEmailSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/email-crypto";

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
