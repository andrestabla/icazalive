"use client";

import { useEffect, useState } from "react";

type Settings = {
  enabled: boolean;
  clientId: string | null;
  hasSecret: boolean;
  allowedDomain: string | null;
  autoProvision: boolean;
  provisionRole: "administrator" | "organizer";
  redirectUri: string;
};

const EMPTY: Settings = {
  enabled: false,
  clientId: "",
  hasSecret: false,
  allowedDomain: "",
  autoProvision: false,
  provisionRole: "organizer",
  redirectUri: "",
};

// Asistente de inicio de sesión con Google (OIDC), configurable por el
// administrador. El client secret se guarda cifrado; el flujo real de login se
// resuelve en /api/auth/sso/*.
export default function GoogleSsoPanel() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations/sso-google", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { data?: Settings } | null) => {
        if (!cancelled && payload?.data) setS({ ...EMPTY, ...payload.data });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const field = (key: keyof Settings, value: string | boolean) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/integrations/sso-google", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: s.enabled,
          clientId: s.clientId,
          ...(secret ? { clientSecret: secret } : {}),
          allowedDomain: s.allowedDomain,
          autoProvision: s.autoProvision,
          provisionRole: s.provisionRole,
        }),
      });
      const payload = (await response.json()) as { data?: Settings; error?: string };
      if (!response.ok) {
        setStatus({ text: payload.error ?? "No fue posible guardar.", error: true });
      } else {
        if (payload.data) setS({ ...EMPTY, ...payload.data });
        setSecret("");
        setStatus({ text: "Configuración de Google guardada.", error: false });
      }
    } catch {
      setStatus({ text: "No fue posible contactar al servidor.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const copyRedirect = () => {
    navigator.clipboard.writeText(s.redirectUri).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <section className="panel sso-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ACCESO CORPORATIVO · GOOGLE</p>
          <h2>Inicio de sesión con Google</h2>
          <p>
            Permite que el equipo entre con su cuenta de Google. Configura las
            credenciales de tu proyecto de Google Cloud aquí; el client secret se
            guarda cifrado.
          </p>
        </div>
        <label className="smtp-toggle">
          <input type="checkbox" checked={s.enabled} onChange={(e) => field("enabled", e.target.checked)} />
          <span>{s.enabled ? "SSO habilitado" : "SSO deshabilitado"}</span>
        </label>
      </div>

      <div className="sso-redirect">
        <span>URI de redirección autorizada (pégala en Google Cloud)</span>
        <div>
          <code>{s.redirectUri || "…"}</code>
          <button type="button" onClick={copyRedirect}>{copied ? "Copiado" : "Copiar"}</button>
        </div>
      </div>

      <div className="smtp-grid">
        <label>
          Client ID
          <input value={s.clientId ?? ""} onChange={(e) => field("clientId", e.target.value)} placeholder="xxxxx.apps.googleusercontent.com" autoComplete="off" />
        </label>
        <label>
          Client Secret
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={s.hasSecret ? "•••••••• (guardado)" : "GOCSPX-…"} name="icaza-google-secret" autoComplete="new-password" />
        </label>
        <label>
          Dominio permitido (opcional)
          <input value={s.allowedDomain ?? ""} onChange={(e) => field("allowedDomain", e.target.value)} placeholder="tuempresa.com" autoComplete="off" />
        </label>
        <label>
          Rol al crear cuenta nueva
          <select value={s.provisionRole} onChange={(e) => field("provisionRole", e.target.value)}>
            <option value="organizer">Organizador</option>
            <option value="administrator">Administrador</option>
          </select>
        </label>
        <label className="smtp-check">
          <input type="checkbox" checked={s.autoProvision} onChange={(e) => field("autoProvision", e.target.checked)} />
          <span>Crear la cuenta automáticamente en el primer ingreso. Sin marcar, solo entran cuentas de personal ya existentes (coincidencia por correo).</span>
        </label>
      </div>

      <p className="smtp-note">
        En Google Cloud: crea un <b>OAuth 2.0 Client ID</b> de tipo <b>Aplicación web</b>,
        configura la pantalla de consentimiento y agrega la URI de redirección de arriba.
        Solo entra personal (administradores y organizadores); los participantes usan su
        enlace personal, no SSO.
      </p>

      <div className="smtp-actions">
        <button className="primary-button" disabled={busy} onClick={() => void save()}>
          {busy ? "Guardando…" : "Guardar configuración"}
        </button>
        {s.enabled && s.clientId && s.hasSecret && (
          <a className="sso-test-link" href="/api/auth/sso/google/start">Probar inicio con Google ↗</a>
        )}
      </div>

      {status && (
        <p className={`smtp-status ${status.error ? "error" : "ok"}`} role="status">
          {status.error ? "⚠ " : "✓ "}
          {status.text}
        </p>
      )}
    </section>
  );
}
