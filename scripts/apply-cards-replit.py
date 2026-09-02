#!/usr/bin/env python3
"""Integraciones en modo tarjeta + modal, sin secciones meta; SSO con rol por
defecto asistente. Idempotente, por anclas/regex sobre la versión de Replit."""
import re, sys

def rw(path, fn):
    s = open(path, encoding="utf-8").read()
    t = fn(s)
    if t != s:
        open(path, "w", encoding="utf-8").write(t)
    return t

def integrations(s):
    if "ExtraIntegrationCards" not in s:
        s = s.replace('import SmtpEmailPanel from "./smtp-email-panel";\nimport GoogleSsoPanel from "./google-sso-panel";\n',
                      'import ExtraIntegrationCards from "./config-cards";\n', 1)
        s = s.replace('      <SmtpEmailPanel />\n      <GoogleSsoPanel />\n', '', 1)
        old = '          </article>\n        </div>\n      </section>\n'
        if old not in s:
            print("FALLO: ancla fin de grilla"); sys.exit(1)
        s = s.replace(old, '          </article>\n          <ExtraIntegrationCards />\n        </div>\n      </section>\n', 1)
    s, n1 = re.subn(r'\n\s*<section className="integration-architecture">[\s\S]*?</section>\n', '\n', s, count=1)
    s, n2 = re.subn(r'\n\s*<section className="panel replit-handoff">[\s\S]*?</section>\n', '\n', s, count=1)
    print(f"OK integrations-client: meta eliminadas={n1+n2}, tarjetas={s.count('ExtraIntegrationCards')}")
    return s

def schema(s):
    return s.replace('provisionRole: userRole("provision_role").notNull().default("organizer")',
                     'provisionRole: userRole("provision_role").notNull().default("participant")', 1)

def css(s):
    if ".service-logo.smtp" in s: return s
    return s + """

/* Tarjetas SMTP/Google y modal de configuracion */
.service-logo.smtp { background: #eef6f4; color: #1a7565; font-size: 10px; font-weight: 800; letter-spacing: .04em; }
.service-logo.google { background: #fff; border: 1px solid #e4e1e9; color: #4285f4; font-weight: 800; font-family: Arial, sans-serif; }
.setup-wizard-card i.connected { color: #1a7565; }
.setup-wizard-card i.pending { color: #8a8695; }
.config-modal { max-width: 860px; }
.config-modal .panel { box-shadow: none; border: 0; padding: 0; margin: 0; }
"""

rw("app/integrations/integrations-client.tsx", integrations)
rw("db/schema.ts", schema)
rw("app/globals.css", css)
print("LISTO tarjetas+modal+rol")
