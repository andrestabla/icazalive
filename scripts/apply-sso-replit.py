#!/usr/bin/env python3
"""Aplica el SSO de Google al entorno de Replit sin clobber: schema, montaje del
panel, botón en el login y CSS. Anclas sobre fragmentos compartidos."""
import sys

def edit(path, pairs, optional=False):
    try:
        s = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        print(f"{'AVISO' if optional else 'FALLO'} {path}: no existe")
        if optional: return
        sys.exit(1)
    applied = skipped = 0
    for i, (old, new) in enumerate(pairs, 1):
        if new in s:
            skipped += 1; continue
        if old not in s:
            print(f"{'AVISO' if optional else 'FALLO'} {path}: ancla {i} no coincide")
            if optional: return
            sys.exit(1)
        s = s.replace(old, new, 1); applied += 1
    open(path, "w", encoding="utf-8").write(s)
    print(f"OK {path}: {applied} aplicada(s), {skipped} presente(s)")

# 1) schema: tabla google_sso_settings
edit("db/schema.ts", [(
"export type Event = typeof events.$inferSelect;",
'''export const googleSsoSettings = pgTable("google_sso_settings", {
  id: text("id").primaryKey().default("default"),
  enabled: boolean("enabled").notNull().default(false),
  clientId: text("client_id"),
  clientSecretEncrypted: text("client_secret_encrypted"),
  allowedDomain: text("allowed_domain"),
  autoProvision: boolean("auto_provision").notNull().default(false),
  provisionRole: userRole("provision_role").notNull().default("organizer"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GoogleSsoSettings = typeof googleSsoSettings.$inferSelect;
export type Event = typeof events.$inferSelect;''',
)])

# 2) montar GoogleSsoPanel en integrations-client (tras SmtpEmailPanel)
edit("app/integrations/integrations-client.tsx", [
('import SmtpEmailPanel from "./smtp-email-panel";',
 'import SmtpEmailPanel from "./smtp-email-panel";\nimport GoogleSsoPanel from "./google-sso-panel";'),
('      <SmtpEmailPanel />\n',
 '      <SmtpEmailPanel />\n      <GoogleSsoPanel />\n'),
])

print("LISTO adiciones SSO deterministas")
