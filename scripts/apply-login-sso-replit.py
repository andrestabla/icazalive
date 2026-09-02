#!/usr/bin/env python3
"""Agrega el botón de Google al login (por anclas, sin clobber del rediseño) y
el CSS del SSO a globals.css. Idempotente."""
import sys

# --- login-form.tsx ---
p = "app/login/login-form.tsx"
s = open(p, encoding="utf-8").read()
if "ssoEnabled" not in s:
    if 'import { FormEvent, useState } from "react";' in s:
        s = s.replace(
            'import { FormEvent, useState } from "react";',
            'import { FormEvent, useEffect, useState } from "react";', 1)
    anchor = "  const [mfaRequired, setMfaRequired] = useState(false);"
    if anchor not in s:
        print("FALLO login: ancla mfaRequired no encontrada"); sys.exit(1)
    inject = anchor + '''
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoError, setSsoError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/sso/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { data?: { enabled: boolean } } | null) => {
        if (!cancelled && payload?.data?.enabled) setSsoEnabled(true);
      })
      .catch(() => undefined);
    const code = new URLSearchParams(window.location.search).get("sso_error");
    if (code) {
      const messages: Record<string, string> = {
        no_account: "Tu cuenta de Google no esta registrada en el equipo. Pide acceso a un administrador.",
        no_staff: "Esa cuenta no tiene permisos de personal.",
        domain: "Tu dominio de correo no esta autorizado para este acceso.",
        inactive: "La cuenta esta desactivada.",
        unverified: "Tu correo de Google no esta verificado.",
        disabled: "El inicio con Google no esta habilitado.",
        cancelled: "Se cancelo el inicio de sesion con Google.",
        state: "La sesion de inicio expiro. Intenta de nuevo.",
        exchange: "No fue posible validar la respuesta de Google.",
        config: "El SSO no esta configurado correctamente.",
      };
      setSsoError(messages[code] ?? "No fue posible iniciar sesion con Google.");
    }
    return () => {
      cancelled = true;
    };
  }, []);'''
    s = s.replace(anchor, inject, 1)

    form_anchor = "          <form className=\"login-form\" onSubmit={submit}>"
    if form_anchor not in s:
        print("FALLO login: ancla form no encontrada"); sys.exit(1)
    button = '''          {ssoError && (
            <div className="login-sso-error" role="alert">{ssoError}</div>
          )}
          {ssoEnabled && (
            <>
              <a className="login-google" href="/api/auth/sso/google/start">
                <span className="login-google-mark">G</span>
                Continuar con Google
              </a>
              <div className="login-divider"><span>o con tu correo</span></div>
            </>
          )}
'''
    s = s.replace(form_anchor, button + form_anchor, 1)
    open(p, "w", encoding="utf-8").write(s)
    print("OK login: boton Google agregado")
else:
    print("OK login: ya presente")

# --- CSS del SSO ---
css_path = "app/globals.css"
css = open(css_path, encoding="utf-8").read()
if ".login-google" not in css:
    block = """

/* Panel SSO Google y boton de login */
.sso-panel { margin-bottom: 20px; }
.sso-redirect { margin-top: 14px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: #faf9fe; }
.sso-redirect > span { display: block; font-size: 11px; font-weight: 650; color: #8a8695; margin-bottom: 6px; }
.sso-redirect > div { display: flex; align-items: center; gap: 8px; }
.sso-redirect code { flex: 1; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; color: #4e4957; word-break: break-all; }
.sso-redirect button { border: 1px solid #cfc4f2; border-radius: 7px; background: #f4f1ff; color: #5b3bd1; padding: 6px 12px; font-size: 12px; font-weight: 650; cursor: pointer; white-space: nowrap; }
.smtp-grid select { border: 1px solid #dfdce5; border-radius: 8px; padding: 9px 10px; font: inherit; font-size: 13px; color: var(--ink); background: #fff; }
.sso-test-link { color: #5b3bd1; font-size: 13px; font-weight: 650; text-decoration: none; }
.sso-test-link:hover { text-decoration: underline; }
.login-google { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 46px; border: 1px solid #dfdce5; border-radius: 10px; background: #fff; color: #3c4043; font-size: 14px; font-weight: 600; text-decoration: none; transition: border-color .15s, background .15s; }
.login-google:hover { border-color: #b9aaeb; background: #f8f6ff; }
.login-google-mark { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 1px solid #e4e1e9; color: #4285f4; font-weight: 800; font-family: Arial, sans-serif; }
.login-divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: #9995a1; font-size: 11px; }
.login-divider::before, .login-divider::after { content: ""; flex: 1; height: 1px; background: #e6e2ea; }
.login-sso-error { margin-bottom: 14px; padding: 10px 12px; border: 1px solid #efc9cf; border-radius: 8px; background: #fff3f5; color: #a24958; font-size: 13px; }
"""
    open(css_path, "a", encoding="utf-8").write(block)
    print("OK css SSO agregado")
else:
    print("OK css: ya presente")
print("LISTO login+css")
