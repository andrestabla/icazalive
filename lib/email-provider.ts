import { readSesConfig, sendWithSes } from "@/lib/aws-ses";

// Interfaz de proveedor de correo saliente. El orden de preferencia es:
// 1. Amazon SES si están definidas sus variables de entorno.
// 2. Resend si se definió RESEND_API_KEY.
// 3. Buzón local de vista previa (desarrollo): la entrega se registra con su
//    cuerpo renderizado, sin salir del equipo.
// Las credenciales viven solo en variables de entorno; nunca en la base.

export type EmailProviderName = "ses" | "resend" | "local";

export type EmailResult =
  | { ok: true; providerId: string }
  | { ok: false; error: string; retryable?: boolean };

export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
};

export function activeProviderName(): EmailProviderName {
  if (readSesConfig()) return "ses";
  if (process.env.RESEND_API_KEY) return "resend";
  return "local";
}

export const providerLabels: Record<EmailProviderName, string> = {
  ses: "Amazon SES",
  resend: "Resend",
  local: "Buzón local de vista previa",
};

export async function sendEmail(email: OutgoingEmail): Promise<EmailResult> {
  const provider = activeProviderName();

  if (provider === "ses") {
    const config = readSesConfig()!;
    const result = await sendWithSes(config, {
      ...email,
      replyTo: email.replyTo ?? process.env.EMAIL_REPLY_TO,
    });
    return result.ok
      ? { ok: true, providerId: result.messageId }
      : { ok: false, error: result.error, retryable: result.retryable };
  }

  if (provider === "resend") {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "eventos@icazalive.local",
          to: [email.to],
          subject: email.subject,
          text: email.body,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        return {
          ok: false,
          error: `Resend ${response.status}: ${detail.slice(0, 200)}`,
          retryable: response.status === 429 || response.status >= 500,
        };
      }
      const payload = (await response.json()) as { id?: string };
      return { ok: true, providerId: payload.id ?? "resend" };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Fallo de red del proveedor.",
        retryable: true,
      };
    }
  }

  // Proveedor local: la entrega se considera realizada al buzón de vista previa.
  return { ok: true, providerId: "local-preview" };
}
