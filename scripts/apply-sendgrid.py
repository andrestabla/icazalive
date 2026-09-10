#!/usr/bin/env python3
"""SendGrid como proveedor de correo saliente: agrega la columna cifrada al
schema y enruta sendEmail por el proveedor guardado (SMTP o SendGrid). Ediciones
ancladas; los archivos propios se copian desde el script de despliegue."""
import os, sys

root = sys.argv[1] if len(sys.argv) > 1 else "."

def edit(rel, pairs):
    path = os.path.join(root, rel)
    try:
        s = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        print(f"FALLO {rel}: no existe"); sys.exit(1)
    applied = skipped = 0
    for i, (olds, new) in enumerate(pairs, 1):
        if new in s:
            skipped += 1; continue
        hit = next((o for o in olds if o in s), None)
        if hit is None:
            print(f"ANCLA NO ENCONTRADA en {rel}: paso {i}"); sys.exit(1)
        s = s.replace(hit, new, 1); applied += 1
    open(path, "w", encoding="utf-8").write(s)
    print(f"OK {rel}: {applied} aplicada(s), {skipped} presente(s)")

edit("db/schema.ts", [(
    ['  smtpPasswordEncrypted: text("smtp_password_encrypted"),\n'],
    '  smtpPasswordEncrypted: text("smtp_password_encrypted"),\n  sendgridApiKeyEncrypted: text("sendgrid_api_key_encrypted"),\n',
)])

SMTP_BLOCK = '''  const smtp = await resolveActiveSmtp().catch(() => null);
  if (smtp) {
    const result = await sendWithSmtp(smtp, {
      ...email,
      replyTo: email.replyTo ?? smtp.replyTo ?? undefined,
    });
    return result.ok
      ? { ok: true, providerId: result.messageId }
      : { ok: false, error: result.error, retryable: result.retryable };
  }
'''
NEW_BLOCK = '''  // El proveedor guardado desde Integraciones (SMTP o SendGrid, si está
  // habilitado) tiene prioridad sobre las variables de entorno.
  const outbound = await resolveActiveOutbound().catch(() => null);
  if (outbound?.kind === "sendgrid") {
    const result = await sendWithSendgrid(outbound.sendgrid, email);
    return result.ok
      ? { ok: true, providerId: result.messageId }
      : { ok: false, error: result.error, retryable: result.retryable };
  }
  if (outbound?.kind === "smtp") {
    const smtp = outbound.smtp;
    const result = await sendWithSmtp(smtp, {
      ...email,
      replyTo: email.replyTo ?? smtp.replyTo ?? undefined,
    });
    return result.ok
      ? { ok: true, providerId: result.messageId }
      : { ok: false, error: result.error, retryable: result.retryable };
  }
'''
edit("lib/email-provider.ts", [
    (['import { resolveActiveSmtp } from "@/lib/email-settings";\nimport { sendWithSmtp } from "@/lib/smtp-sender";'],
     'import { resolveActiveOutbound } from "@/lib/email-settings";\nimport { sendWithSendgrid } from "@/lib/sendgrid-sender";\nimport { sendWithSmtp } from "@/lib/smtp-sender";'),
    (['export type EmailProviderName = "smtp" | "ses" | "resend" | "local";'],
     'export type EmailProviderName = "smtp" | "sendgrid" | "ses" | "resend" | "local";'),
    (['  smtp: "SMTP",\n  ses: "Amazon SES",'],
     '  smtp: "SMTP",\n  sendgrid: "SendGrid",\n  ses: "Amazon SES",'),
    (['  // La configuración SMTP guardada desde la UI (si está habilitada) tiene\n  // prioridad sobre las variables de entorno.\n' + SMTP_BLOCK, SMTP_BLOCK],
     NEW_BLOCK),
])
print("LISTO sendgrid")
