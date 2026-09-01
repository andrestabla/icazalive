import nodemailer from "nodemailer";
import type { ResolvedSmtpConfig } from "@/lib/email-settings";

export type SmtpResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

// Envía un correo por SMTP con la configuración guardada desde la UI. El
// remitente usa el nombre y la dirección definidos por el administrador.
export async function sendWithSmtp(
  config: ResolvedSmtpConfig,
  email: { to: string; subject: string; body: string; html?: string; replyTo?: string },
): Promise<SmtpResult> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true para 465; false usa STARTTLS en 587
    auth: { user: config.username, pass: config.password },
  });

  const from = config.fromName
    ? `${config.fromName} <${config.fromEmail}>`
    : config.fromEmail;

  try {
    const info = await transport.sendMail({
      from,
      to: email.to,
      subject: email.subject,
      text: email.body,
      ...(email.html ? { html: email.html } : {}),
      replyTo: email.replyTo ?? config.replyTo ?? undefined,
    });
    return { ok: true, messageId: info.messageId ?? "smtp" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fallo SMTP.";
    // Autenticación o remitente rechazado no se reintentan; red/timeout sí.
    const retryable = /timeout|econn|network|temporar/i.test(message);
    return { ok: false, error: message, retryable };
  }
}
