"use client";

import { FormEvent, useEffect, useState } from "react";

export default function LoginForm({
  returnTo,
  showLocalCredentials,
}: {
  returnTo: string;
  showLocalCredentials: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
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
        no_account: "Tu cuenta de Google no está registrada en el equipo. Pide acceso a un administrador.",
        no_staff: "Esa cuenta no tiene permisos de personal.",
        domain: "Tu dominio de correo no está autorizado para este acceso.",
        inactive: "La cuenta está desactivada.",
        unverified: "Tu correo de Google no está verificado.",
        disabled: "El inicio con Google no está habilitado.",
        cancelled: "Se canceló el inicio de sesión con Google.",
        state: "La sesión de inicio expiró. Intenta de nuevo.",
        exchange: "No fue posible validar la respuesta de Google.",
        config: "El SSO no está configurado correctamente.",
      };
      setSsoError(messages[code] ?? "No fue posible iniciar sesión con Google.");
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        totpCode: form.get("totpCode") || undefined,
        returnTo,
      }),
    });
    const payload = (await response.json()) as {
      data?: { returnTo?: string; mfaRequired?: boolean };
      error?: string;
      mfaRequired?: boolean;
    };

    if (payload.data?.mfaRequired) {
      setMfaRequired(true);
      setError("");
      setLoading(false);
      return;
    }
    if (!response.ok || !payload.data) {
      if (payload.mfaRequired) setMfaRequired(true);
      setError(payload.error ?? "No fue posible iniciar sesión.");
      setLoading(false);
      return;
    }

    window.location.assign(payload.data.returnTo!);
  };

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <div className="brand-mark">I</div>
          <span>Icaza Jammoul Live</span>
        </div>
        <div className="story-copy">
          <span className="story-label">EVENTOS QUE CONECTAN</span>
          <h1>Todo tu evento,<br />en un solo lugar.</h1>
          <p>Crea experiencias memorables, conecta con tu audiencia y convierte cada interacción en información valiosa.</p>
          <div className="story-proof">
            <div><b>5.000</b><span>asistentes por evento</span></div>
            <div><b>En vivo</b><span>Zoom + Amazon IVS</span></div>
            <div><b>360°</b><span>analítica y engagement</span></div>
          </div>
        </div>
        <div className="story-footer">Plataforma privada · Icaza Jammoul</div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-mobile-brand">
            <div className="brand-mark">I</div>
            <span>Icaza Jammoul Live</span>
          </div>
          <p className="eyebrow">BIENVENIDO DE NUEVO</p>
          <h2>Inicia sesión</h2>
          <p className="login-intro">Ingresa con tu cuenta administrativa para continuar.</p>

          {ssoError && (
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
          <form className="login-form" onSubmit={submit}>
            <label>
              Correo electrónico
              <div className="login-input"><span>＠</span><input name="email" type="email" autoComplete="email" required placeholder="nombre@empresa.com" /></div>
            </label>
            <label>
              <span className="label-row"><span>Contraseña</span><small>Acceso privado</small></span>
              <div className="login-input">
                <span>⌑</span>
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required minLength={8} maxLength={128} placeholder="Tu contraseña" />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? "Ocultar" : "Ver"}</button>
              </div>
            </label>
            {mfaRequired && (
              <label>
                Código de verificación
                <input
                  name="totpCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={11}
                  placeholder="Código de tu app o de respaldo"
                  autoFocus
                />
                <small className="field-help">
                  Ingresa el código de 6 dígitos de tu app autenticadora o un código de respaldo.
                </small>
              </label>
            )}
            {error && <div className="login-error" role="alert">ⓘ {error}</div>}
            <button className="login-submit" disabled={loading}>{loading ? "Validando…" : "Ingresar a Icaza Jammoul Live"}<span>→</span></button>
          </form>

          {showLocalCredentials && (
            <div className="local-access">
              <span>DESARROLLO LOCAL</span>
              <p><b>Usuario:</b> andres@icazalive.local</p>
              <p><b>Contraseña:</b> IcazaLive2026!</p>
            </div>
          )}

          <p className="login-help">Para recuperar el acceso, contacta al administrador de la plataforma.</p>
        </div>
      </section>
    </main>
  );
}
