#!/usr/bin/env python3
"""Aplica el asistente SMTP al entorno de Replit sin clobber: adiciona la tabla
al schema, integra SMTP en email-provider y agrega el CSS. El montaje del panel
en integrations-client se maneja aparte (anclas variables por el rediseño)."""
import sys

def edit(path, pairs):
    try:
        s = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        print(f"FALLO {path}: no existe"); sys.exit(1)
    applied = skipped = 0
    for i, (old, new) in enumerate(pairs, 1):
        if new in s:
            skipped += 1; continue
        if old not in s:
            print(f"FALLO {path}: ancla {i} no coincide"); sys.exit(1)
        s = s.replace(old, new, 1); applied += 1
    open(path, "w", encoding="utf-8").write(s)
    print(f"OK {path}: {applied} aplicada(s), {skipped} presente(s)")

# 1) schema: tabla outbound_email_settings
edit("db/schema.ts", [(
"export type Event = typeof events.$inferSelect;",
'''export const outboundEmailSettings = pgTable("outbound_email_settings", {
  id: text("id").primaryKey().default("default"),
  provider: text("provider").notNull().default("smtp"),
  enabled: boolean("enabled").notNull().default(false),
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  replyTo: text("reply_to"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  smtpUsername: text("smtp_username"),
  smtpPasswordEncrypted: text("smtp_password_encrypted"),
  region: text("region"),
  configurationSet: text("configuration_set"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OutboundEmailSettings = typeof outboundEmailSettings.$inferSelect;
export type Event = typeof events.$inferSelect;''',
)])

# 2) email-provider: import + tipo + prioridad SMTP
edit("lib/email-provider.ts", [
(
'import { readSesConfig, sendWithSes } from "@/lib/aws-ses";',
'''import { readSesConfig, sendWithSes } from "@/lib/aws-ses";
import { resolveActiveSmtp } from "@/lib/email-settings";
import { sendWithSmtp } from "@/lib/smtp-sender";'''
),
(
'export type EmailProviderName = "ses" | "resend" | "local";',
'export type EmailProviderName = "smtp" | "ses" | "resend" | "local";'
),
(
'''export const providerLabels: Record<EmailProviderName, string> = {
  ses: "Amazon SES",''',
'''export const providerLabels: Record<EmailProviderName, string> = {
  smtp: "SMTP",
  ses: "Amazon SES",'''
),
(
'''export async function sendEmail(email: OutgoingEmail): Promise<EmailResult> {
  const provider = activeProviderName();''',
'''export async function sendEmail(email: OutgoingEmail): Promise<EmailResult> {
  const smtp = await resolveActiveSmtp().catch(() => null);
  if (smtp) {
    const result = await sendWithSmtp(smtp, {
      ...email,
      replyTo: email.replyTo ?? smtp.replyTo ?? undefined,
    });
    return result.ok
      ? { ok: true, providerId: result.messageId }
      : { ok: false, error: result.error, retryable: result.retryable };
  }

  const provider = activeProviderName();'''
),
])

print("LISTO adiciones deterministas")
