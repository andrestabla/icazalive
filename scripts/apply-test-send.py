#!/usr/bin/env python3
"""Añade el paso de correo de prueba al asistente de SES (API + UI).
Ediciones con verificación exacta; si un fragmento no coincide, el archivo
queda intacto y se reporta FALLO."""

import sys

EDITS = [
    (
        "app/api/integrations/route.ts",
        [
            (
                '''import { activeProviderName, providerLabels } from "@/lib/email-provider";''',
                '''import {
  activeProviderName,
  providerLabels,
  sendEmail,
} from "@/lib/email-provider";''',
            ),
            (
                '''    action?: "save" | "check";''',
                '''    action?: "save" | "check" | "test_send";
    testRecipient?: string;''',
            ),
            (
                '''      body.action !== "check")''',
                '''      body.action !== "check" &&
      body.action !== "test_send")''',
            ),
            (
                '''  // Para Amazon IVS, "revisar" comprueba que las credenciales del servidor''',
                '''  // Correo de prueba: envía un mensaje real mediante el proveedor activo
  // (Amazon SES cuando está configurado) sin tocar la configuración guardada.
  if (body.provider === "email" && body.action === "test_send") {
    const recipient =
      typeof body.testRecipient === "string" ? body.testRecipient.trim() : "";
    if (
      !recipient ||
      recipient.length > 320 ||
      !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(recipient)
    ) {
      return NextResponse.json(
        { error: "Indica un destinatario válido para el correo de prueba." },
        { status: 400 },
      );
    }
    const providerName = providerLabels[activeProviderName()];
    const result = await sendEmail({
      to: recipient,
      subject: "Correo de prueba — Icaza Live",
      body: `Este es un correo de prueba enviado desde la configuración de correo saliente de Icaza Live (proveedor: ${providerName}). Si lo estás leyendo, el envío funciona correctamente.`,
    });
    await writeAuditLog({
      actor: auth.user,
      action: "integration.email_test_sent",
      resourceType: "integration",
      resourceId: "email",
      summary: result.ok
        ? `Correo de prueba enviado a ${recipient}.`
        : `Falló el correo de prueba a ${recipient}.`,
      details: { recipient, provider: providerName, ok: result.ok },
      request,
    });
    return NextResponse.json({
      data: {
        testSend: result.ok
          ? {
              ok: true,
              detail: `Correo de prueba enviado a ${recipient} mediante ${providerName}. Revisa la bandeja de entrada (y la carpeta de spam).`,
            }
          : { ok: false, detail: `El proveedor rechazó el envío: ${result.error}` },
      },
    });
  }

  // Para Amazon IVS, "revisar" comprueba que las credenciales del servidor''',
            ),
        ],
    ),
    (
        "app/integrations/integrations-client.tsx",
        [
            (
                '''  const [identityDraft, setIdentityDraft] = useState(initialIdentity.settings);''',
                '''  const [identityDraft, setIdentityDraft] = useState(initialIdentity.settings);
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
  };''',
            ),
            (
                '''                  {emailCheck && (
                    <p
                      className={`wizard-note ${emailCheck.ok ? "ok" : "warning"}`}
                      role="status"
                    >
                      {emailCheck.ok ? "✓ " : "⚠ "}
                      {emailCheck.detail}
                      {emailCheck.quota
                        ? ` Cuota diaria: ${emailCheck.quota.toLocaleString("es-CO")} correos.`
                        : ""}
                    </p>
                  )}
                </div>
              )}''',
                '''                  {emailCheck && (
                    <p
                      className={`wizard-note ${emailCheck.ok ? "ok" : "warning"}`}
                      role="status"
                    >
                      {emailCheck.ok ? "✓ " : "⚠ "}
                      {emailCheck.detail}
                      {emailCheck.quota
                        ? ` Cuota diaria: ${emailCheck.quota.toLocaleString("es-CO")} correos.`
                        : ""}
                    </p>
                  )}
                  <div className="wizard-field" style={{ marginTop: 18 }}>
                    <label htmlFor="test-email-to">
                      Enviar correo de prueba
                    </label>
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
                </div>
              )}''',
            ),
        ],
    ),
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
