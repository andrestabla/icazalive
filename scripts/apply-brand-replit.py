#!/usr/bin/env python3
"""Aplica en Replit: correos con marca, origen público, plantillas por defecto
y el panel de correo de prueba (anclas adaptadas a la UI rediseñada)."""

import sys

BOTON_PRUEBA = '''                <div className="wizard-field" style={{ marginTop: 18 }}>
                  <label htmlFor="test-email-to">Enviar correo de prueba</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      id="test-email-to"
                      type="email"
                      placeholder="destinatario@empresa.com"
                      value={testEmailTo}
                      onChange={(event) => setTestEmailTo(event.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="primary-button"
                      disabled={testEmailSending || !testEmailTo.trim()}
                      onClick={() => void sendTestEmail()}
                    >
                      {testEmailSending ? "Enviando…" : "Enviar prueba"}
                    </button>
                  </div>
                  <small>
                    Envía un mensaje real con el proveedor activo. En modo
                    prueba (sandbox), el destinatario debe estar verificado en
                    SES.
                  </small>
                  {testEmailResult && (
                    <p
                      className={`wizard-note ${testEmailResult.ok ? "ok" : "warning"}`}
                      role="status"
                    >
                      {testEmailResult.ok ? "✓ " : "⚠ "}
                      {testEmailResult.detail}
                    </p>
                  )}
                </div>
                {emailCheck && ('''

ESTADO_PRUEBA = '''  const [identityDraft, setIdentityDraft] = useState(initialIdentity.settings);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    ok: boolean;
    detail: string;
  } | null>(null);

  const sendTestEmail = async () => {
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const response = await fetch("/api/integrations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          action: "test_send",
          testRecipient: testEmailTo,
        }),
      });
      const payload = (await response.json()) as {
        data?: { testSend?: { ok: boolean; detail: string } };
        error?: string;
      };
      if (!response.ok || !payload.data?.testSend) {
        setTestEmailResult({
          ok: false,
          detail: payload.error ?? "No fue posible enviar el correo de prueba.",
        });
      } else {
        setTestEmailResult(payload.data.testSend);
      }
    } catch {
      setTestEmailResult({
        ok: false,
        detail: "No fue posible contactar al servidor.",
      });
    } finally {
      setTestEmailSending(false);
    }
  };'''

BOTON_PRECARGA = '''>Precarga la secuencia estándar de la plataforma y edítala aquí.</p>
                  <button
                    className="primary-button"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      void (async () => {
                        const response = await fetch(
                          `/api/events/${event.slug}/communications`,
                          { method: "POST" },
                        );
                        if (response.ok) window.location.reload();
                      })();
                    }}
                  >
                    Precargar plantillas del sistema
                  </button>'''

EDITS = [
    ("app/integrations/integrations-client.tsx", [
        ("  const [identityDraft, setIdentityDraft] = useState(initialIdentity.settings);", ESTADO_PRUEBA),
        ("{emailCheck && (", BOTON_PRUEBA),
    ]),
    ("app/api/integrations/route.ts", [
        ('import { readIvsCredentials, verifyIvsAccess } from "@/lib/aws-ivs";',
         'import { readIvsCredentials, verifyIvsAccess } from "@/lib/aws-ivs";\nimport { renderBrandedEmail } from "@/lib/email-branding";\nimport { getBrandSettings } from "@/lib/brand";'),
        ('''    const providerName = providerLabels[activeProviderName()];
    const result = await sendEmail({
      to: recipient,
      subject: "Correo de prueba — Icaza Live",
      body: `Este es un correo de prueba enviado desde la configuración de correo saliente de Icaza Live (proveedor: ${providerName}). Si lo estás leyendo, el envío funciona correctamente.`,
    });''',
         '''    const providerName = providerLabels[activeProviderName()];
    const testBody = `Este es un correo de prueba enviado desde la configuración de correo saliente de Icaza Live (proveedor: ${providerName}). Si lo estás leyendo, el envío funciona correctamente.`;
    const brand = await getBrandSettings().catch(() => null);
    const result = await sendEmail({
      to: recipient,
      subject: "Correo de prueba — Icaza Live",
      body: testBody,
      html: renderBrandedEmail({ bodyText: testBody, brand }),
    });'''),
        ('''      actor: user,
      action: "integration.email_test_sent",''',
         '''      actor: auth.user,
      action: "integration.email_test_sent",'''),
    ]),
    ("lib/aws-ses.ts", [
        ('''export async function sendWithSes(
  config: SesConfig,
  email: { to: string; subject: string; body: string; replyTo?: string },
): Promise<SesSendResult> {''',
         '''export async function sendWithSes(
  config: SesConfig,
  email: {
    to: string;
    subject: string;
    body: string;
    html?: string;
    replyTo?: string;
  },
): Promise<SesSendResult> {'''),
        ('''        Body: { Text: { Data: email.body, Charset: "UTF-8" } },''',
         '''        Body: {
          Text: { Data: email.body, Charset: "UTF-8" },
          ...(email.html
            ? { Html: { Data: email.html, Charset: "UTF-8" } }
            : {}),
        },'''),
    ]),
    ("lib/email-provider.ts", [
        ('''export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
};''',
         '''export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  replyTo?: string;
};'''),
        ('''          subject: email.subject,
          text: email.body,
        }),''',
         '''          subject: email.subject,
          text: email.body,
          ...(email.html ? { html: email.html } : {}),
        }),'''),
    ]),
    ("lib/communication-worker.ts", [
        ('from "@/lib/email-provider";',
         'from "@/lib/email-provider";\nimport { renderBrandedEmail } from "@/lib/email-branding";\nimport { getBrandSettings } from "@/lib/brand";'),
        ('''  for (const delivery of due) {
    const result = await sendEmail({
      to: delivery.recipientEmail,
      subject: delivery.subject,
      body: delivery.body,
    });''',
         '''  const brand = await getBrandSettings().catch(() => null);

  for (const delivery of due) {
    const result = await sendEmail({
      to: delivery.recipientEmail,
      subject: delivery.subject,
      body: delivery.body,
      html: renderBrandedEmail({ bodyText: delivery.body, brand }),
    });'''),
    ]),
    ("app/api/public/events/[slug]/register/route.ts", [
        ('import { renderParticipantCommunication } from "@/lib/communication-renderer";',
         'import { renderParticipantCommunication } from "@/lib/communication-renderer";\nimport { getPublicOrigin } from "@/lib/public-origin";'),
        ("  const origin = new URL(request.url).origin;",
         "  const origin = getPublicOrigin(request);"),
    ]),
    ("app/api/participants/invite/route.ts", [
        ('import { and, count, eq } from "drizzle-orm";',
         'import { and, count, eq } from "drizzle-orm";\nimport { getPublicOrigin } from "@/lib/public-origin";'),
        ("  const origin = new URL(request.url).origin;",
         "  const origin = getPublicOrigin(request);"),
    ]),
    ("app/api/events/route.ts", [
        ('import { writeAuditLog } from "@/lib/audit";',
         'import { writeAuditLog } from "@/lib/audit";\nimport { DEFAULT_COMMUNICATIONS } from "@/lib/default-communications";'),
        ('''          offsetMinutes: message.offsetMinutes,
        })),
      );
    }''',
         '''          offsetMinutes: message.offsetMinutes,
        })),
      );
    } else {
      // Sin plantilla elegida, el evento nace con la secuencia estándar.
      await transaction.insert(communicationMessages).values(
        DEFAULT_COMMUNICATIONS.map((message) => ({
          eventId: event.id,
          type: message.type,
          subject: message.subject,
          body: message.body,
          enabled: message.enabled,
          offsetMinutes: message.offsetMinutes,
        })),
      );
    }'''),
    ]),
    ("app/api/events/[slug]/communications/route.ts", [
        ('import { writeAuditLog } from "@/lib/audit";',
         'import { writeAuditLog } from "@/lib/audit";\nimport { DEFAULT_COMMUNICATIONS } from "@/lib/default-communications";'),
        ("export async function PATCH(request: Request, context: RouteContext) {",
         '''// Precarga la secuencia estándar de la plataforma en un evento sin mensajes.
export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const auth = await getStaffUser();
  if ("error" in auth) return auth.error;

  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const existing = await db
    .select({ id: communicationMessages.id })
    .from(communicationMessages)
    .where(eq(communicationMessages.eventId, event.id))
    .limit(1);
  if (existing.length) {
    return NextResponse.json(
      { error: "El evento ya tiene plantillas de comunicación." },
      { status: 409 },
    );
  }

  await db.insert(communicationMessages).values(
    DEFAULT_COMMUNICATIONS.map((message) => ({
      eventId: event.id,
      type: message.type,
      subject: message.subject,
      body: message.body,
      enabled: message.enabled,
      offsetMinutes: message.offsetMinutes,
    })),
  );

  await writeAuditLog({
    actor: auth.user,
    action: "communication.defaults_loaded",
    resourceType: "event",
    resourceId: event.id,
    summary: `Plantillas estándar precargadas para “${event.title}”.`,
    request,
  });
  return NextResponse.json({ data: { loaded: DEFAULT_COMMUNICATIONS.length } });
}

export async function PATCH(request: Request, context: RouteContext) {'''),
    ]),
    ("app/events/[slug]/event-detail.tsx", [
        (">Ejecuta los datos iniciales para crear la secuencia del evento.</p>", BOTON_PRECARGA),
    ]),
]


def main() -> int:
    failures = 0
    for path, replacements in EDITS:
        try:
            with open(path, encoding="utf-8") as handle:
                content = handle.read()
        except FileNotFoundError:
            print(f"FALLO  {path}: no existe.")
            failures += 1
            continue
        updated = content
        applied = 0
        skipped = 0
        broken = None
        for index, (old, new) in enumerate(replacements, start=1):
            if new in updated:
                skipped += 1
                continue
            if old not in updated:
                broken = index
                break
            updated = updated.replace(old, new, 1)
            applied += 1
        if broken is not None:
            print(f"FALLO  {path}: edición {broken} no coincide; sin tocar.")
            failures += 1
            continue
        if applied:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(updated)
        print(f"OK     {path}: {applied} aplicada(s), {skipped} ya presente(s).")
    print("LISTO" if not failures else f"{failures} archivo(s) con fallo")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
