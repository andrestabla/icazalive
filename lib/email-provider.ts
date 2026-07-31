// Interfaz de proveedor de correo. En local entrega al "buzón de vista
// previa" (la entrega queda registrada con su cuerpo renderizado). Al
// desplegar, define RESEND_API_KEY y EMAIL_FROM para envío real vía API
// sin cambiar el worker.

export type EmailResult =
  | { ok: true; providerId: string }
  | { ok: false; error: string };

export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
};

export function activeProviderName(): "resend" | "local" {
  return process.env.RESEND_API_KEY ? "resend" : "local";
}

export async function sendEmail(email: OutgoingEmail): Promise<EmailResult> {
  if (activeProviderName() === "resend") {
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
        return { ok: false, error: `Resend ${response.status}: ${detail.slice(0, 200)}` };
      }
      const payload = (await response.json()) as { id?: string };
      return { ok: true, providerId: payload.id ?? "resend" };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Fallo de red del proveedor.",
      };
    }
  }
  // Proveedor local: la entrega se considera realizada al buzón de vista previa.
  return { ok: true, providerId: `local-preview` };
}
