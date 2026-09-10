import type { ResolvedSendgridConfig } from "@/lib/email-settings";

export type SendgridResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

const API = "https://api.sendgrid.com/v3";
const TIMEOUT_MS = 15_000;

type SendgridErrorBody = { errors?: Array<{ message?: string; field?: string | null }> };

// Traduce las respuestas de error de SendGrid a un mensaje accionable.
async function describeError(response: Response): Promise<string> {
  let detail = "";
  try {
    const payload = (await response.json()) as SendgridErrorBody;
    detail = (payload.errors ?? [])
      .map((item) => [item.field, item.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(" · ")
      .slice(0, 300);
  } catch {
    detail = "";
  }
  if (response.status === 401) {
    return `SendGrid rechazó la clave de API (401). Verifica que la clave esté vigente y tenga el permiso "Mail Send".${detail ? ` Detalle: ${detail}` : ""}`;
  }
  if (response.status === 403) {
    return `SendGrid no permite enviar desde ese remitente (403). Autentica el dominio del remitente en Settings → Sender Authentication.${detail ? ` Detalle: ${detail}` : ""}`;
  }
  if (response.status === 429) {
    return "SendGrid limitó la tasa de envío (429). Se reintentará.";
  }
  return `SendGrid ${response.status}${detail ? `: ${detail}` : ""}`;
}

// Envía un correo por la API v3 de SendGrid (Mail Send). Un 202 significa que
// SendGrid aceptó el mensaje para entrega; el id llega en X-Message-Id.
export async function sendWithSendgrid(
  config: ResolvedSendgridConfig,
  email: { to: string; subject: string; body: string; html?: string; replyTo?: string },
): Promise<SendgridResult> {
  const replyTo = email.replyTo ?? config.replyTo ?? undefined;
  const payload = {
    personalizations: [{ to: [{ email: email.to }] }],
    from: { email: config.fromEmail, ...(config.fromName ? { name: config.fromName } : {}) },
    ...(replyTo ? { reply_to: { email: replyTo } } : {}),
    subject: email.subject,
    content: [
      { type: "text/plain", value: email.body },
      ...(email.html ? [{ type: "text/html", value: email.html }] : []),
    ],
  };
  try {
    const response = await fetch(`${API}/mail/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 202 || response.ok) {
      return { ok: true, messageId: response.headers.get("x-message-id") ?? "sendgrid" };
    }
    return {
      ok: false,
      error: await describeError(response),
      retryable: response.status === 429 || response.status >= 500,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fallo de red con SendGrid.";
    return { ok: false, error: message, retryable: true };
  }
}

export type SendgridCheck = {
  ok: boolean;
  detail: string;
  mailSend: boolean;
  domainAuthenticated: boolean | null;
  authenticatedDomains: string[];
};

// Comprueba la clave sin enviar nada: permisos de la clave (GET /scopes) y, si
// la clave lo permite, si el dominio del remitente está autenticado (DKIM/SPF).
export async function verifySendgridAccess(
  apiKey: string,
  fromEmail: string | null,
): Promise<SendgridCheck> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  let scopes: string[] = [];
  try {
    const response = await fetch(`${API}/scopes`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        ok: false,
        detail: await describeError(response),
        mailSend: false,
        domainAuthenticated: null,
        authenticatedDomains: [],
      };
    }
    scopes = ((await response.json()) as { scopes?: string[] }).scopes ?? [];
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? `No fue posible contactar a SendGrid: ${error.message}` : "No fue posible contactar a SendGrid.",
      mailSend: false,
      domainAuthenticated: null,
      authenticatedDomains: [],
    };
  }

  const mailSend = scopes.includes("mail.send");
  if (!mailSend) {
    return {
      ok: false,
      detail: 'La clave de API es válida pero no tiene el permiso "Mail Send". Crea una clave con acceso restringido y activa Mail Send.',
      mailSend,
      domainAuthenticated: null,
      authenticatedDomains: [],
    };
  }

  // Dominios autenticados (requiere el permiso whitelabel.read; si falta, se
  // informa sin marcar error).
  let domainAuthenticated: boolean | null = null;
  let authenticatedDomains: string[] = [];
  const fromDomain = fromEmail?.split("@")[1]?.toLowerCase() ?? null;
  try {
    const response = await fetch(`${API}/whitelabel/domains?limit=50`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) {
      const domains = (await response.json()) as Array<{ domain?: string; valid?: boolean }>;
      authenticatedDomains = domains
        .filter((item) => item.valid && item.domain)
        .map((item) => String(item.domain).toLowerCase());
      if (fromDomain) domainAuthenticated = authenticatedDomains.includes(fromDomain);
    }
  } catch {
    domainAuthenticated = null;
  }

  if (fromDomain && domainAuthenticated === false) {
    return {
      ok: true,
      detail: `Clave válida con permiso Mail Send. El dominio ${fromDomain} aún no aparece autenticado en SendGrid: los correos pueden ir a spam o ser rechazados. Autentícalo en Settings → Sender Authentication → Authenticate Your Domain.`,
      mailSend,
      domainAuthenticated,
      authenticatedDomains,
    };
  }
  return {
    ok: true,
    detail:
      domainAuthenticated === true
        ? `Clave válida con permiso Mail Send y dominio ${fromDomain} autenticado. Listo para enviar.`
        : "Clave válida con permiso Mail Send. No fue posible comprobar la autenticación del dominio con esta clave (falta el permiso Sender Authentication de lectura); verifícala en SendGrid.",
    mailSend,
    domainAuthenticated,
    authenticatedDomains,
  };
}
