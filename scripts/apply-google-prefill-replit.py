#!/usr/bin/env python3
"""Registro público: botón "Continuar con Google" que prellena nombre y correo.
Idempotente y por anclas sobre la versión de Replit. Los archivos de rutas SSO
y lib/google-sso.ts se copian completos desde /tmp/d (son propios)."""
import os, shutil, sys

SRC = os.environ.get("SRC", "/tmp/d/icazalive-feat-aws-ivs-s3")

def rw(path, fn):
    s = open(path, encoding="utf-8").read()
    t = fn(s)
    if t != s:
        open(path, "w", encoding="utf-8").write(t)
    return t

for rel in ["lib/google-sso.ts",
            "app/api/auth/sso/google/start/route.ts",
            "app/api/auth/sso/callback/route.ts"]:
    shutil.copyfile(os.path.join(SRC, rel), rel)
    print("copiado", rel)

def page(s):
    if "decodePrefill(" in s: return s
    s = s.replace('import { notFound } from "next/navigation";\n','import { cookies } from "next/headers";\nimport { notFound } from "next/navigation";\n',1)
    s = s.replace('import { getPublishedLegalDocuments } from "@/lib/privacy";\n','import {\n  REGISTRATION_PREFILL_COOKIE,\n  decodePrefill,\n  isSsoUsable,\n  readGoogleSso,\n} from "@/lib/google-sso";\nimport { getPublishedLegalDocuments } from "@/lib/privacy";\n',1)
    s = s.replace('  const [[event], brand, legalDocuments] = await Promise.all([','  const [[event], brand, legalDocuments, googleSso, cookieStore] = await Promise.all([',1)
    s = s.replace('    getBrandSettings(),\n    getPublishedLegalDocuments(),\n  ]);\n','    getBrandSettings(),\n    getPublishedLegalDocuments(),\n    readGoogleSso().catch(() => null),\n    cookies(),\n  ]);\n',1)
    s = s.replace('  return (\n    <RegistrationForm\n','  // Datos devueltos por Google (si el asistente pulsó "Continuar con Google").\n  const googlePrefill = decodePrefill(\n    cookieStore.get(REGISTRATION_PREFILL_COOKIE)?.value,\n    slug,\n  );\n\n  return (\n    <RegistrationForm\n',1)
    s = s.replace('      fields={fields}\n      legalDocuments={{','      fields={fields}\n      googleEnabled={isSsoUsable(googleSso)}\n      googlePrefill={googlePrefill ? { name: googlePrefill.name, email: googlePrefill.email } : null}\n      legalDocuments={{',1)
    for needle in ['googleEnabled={isSsoUsable(googleSso)}', 'cookies(),', 'decodePrefill(']:
        if needle not in s:
            print("FALLO page.tsx: ancla", needle); sys.exit(1)
    print("OK page.tsx")
    return s

def form(s):
    if "registration-google" in s: return s
    s = s.replace('import { useState } from "react";','import { useEffect, useState } from "react";',1)
    old1 = '''  fields,
  legalDocuments,
}: {
  event: PublicEvent;
  brand: PublicBrand;
  fields: RegistrationFieldDefinition[];
'''
    if old1 not in s: print("FALLO form: props"); sys.exit(1)
    s = s.replace(old1, '''  fields,
  googleEnabled = false,
  googlePrefill = null,
  legalDocuments,
}: {
  event: PublicEvent;
  brand: PublicBrand;
  fields: RegistrationFieldDefinition[];
  googleEnabled?: boolean;
  googlePrefill?: { name: string; email: string } | null;
''', 1)
    old2 = '  const [calendarUrl, setCalendarUrl] = useState("");\n'
    if old2 not in s: print("FALLO form: state"); sys.exit(1)
    s = s.replace(old2, old2 + '''  const [googleError, setGoogleError] = useState("");
  const [googleLinked, setGoogleLinked] = useState(Boolean(googlePrefill));

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("sso_error");
    if (!code) return;
    const messages: Record<string, string> = {
      cancelled: "Se canceló la conexión con Google. Puedes completar los datos manualmente.",
      unverified: "Google no ha verificado ese correo. Escríbelo manualmente.",
      disabled: "El acceso con Google no está disponible por ahora.",
    };
    setGoogleError(messages[code] ?? "No fue posible obtener tus datos de Google. Complétalos manualmente.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
''', 1)
    old = '''              <form className="public-form" onSubmit={submit}>
                <label>Nombre completo *<input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Tu nombre y apellido" /></label>
                <label>Correo electrónico *<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="nombre@empresa.com" /></label>
'''
    if old not in s: print("FALLO form: inputs"); sys.exit(1)
    s = s.replace(old, '''              {googleEnabled && !googleLinked && (
                <div className="registration-google">
                  <a
                    className="login-google"
                    href={`/api/auth/sso/google/start?intent=prefill&slug=${encodeURIComponent(event.slug)}`}
                  >
                    <span className="login-google-mark">G</span>
                    Continuar con Google
                  </a>
                  <p>Toma tu nombre y correo de tu cuenta de Google. El resto lo completas aquí.</p>
                  <div className="login-divider"><span>o escribe tus datos</span></div>
                </div>
              )}
              {googleLinked && googlePrefill && (
                <div className="registration-google-linked" role="status">
                  <span className="login-google-mark">G</span>
                  <p>Nombre y correo tomados de <b>{googlePrefill.email}</b>. Puedes editarlos si lo necesitas.</p>
                  <button type="button" onClick={() => setGoogleLinked(false)}>Usar otros datos</button>
                </div>
              )}
              {googleError && <div className="login-sso-error" role="alert">{googleError}</div>}
              <form className="public-form" onSubmit={submit}>
                <label>Nombre completo *<input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Tu nombre y apellido" defaultValue={googlePrefill?.name ?? ""} /></label>
                <label>Correo electrónico *<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="nombre@empresa.com" defaultValue={googlePrefill?.email ?? ""} /></label>
''', 1)
    print("OK registration-form.tsx")
    return s

def css(s):
    if '.registration-google ' in s: return s
    print("OK globals.css")
    return s + '''

/* Registro publico: prellenar con Google */
.registration-google { display: grid; gap: 8px; margin: 4px 0 6px; }
.registration-google > p { margin: 0; color: #6f6b7a; font-size: 12px; text-align: center; }
.registration-google .login-divider { margin: 6px 0 2px; }
.registration-google-linked { display: flex; align-items: center; gap: 10px; margin: 4px 0 14px; padding: 10px 12px; border: 1px solid #d9e8f7; border-radius: 10px; background: #f3f8fe; color: #2f3a4a; font-size: 13px; }
.registration-google-linked p { flex: 1; margin: 0; }
.registration-google-linked button { border: 0; background: none; color: #4a5bd6; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: underline; }
'''

rw("app/register/[slug]/page.tsx", page)
rw("app/register/[slug]/registration-form.tsx", form)
rw("app/globals.css", css)
print("LISTO")
