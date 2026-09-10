"use client";

import { useEffect, useState } from "react";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";
import "./email-provider.css";

type Provider = "smtp" | "sendgrid";

type Settings = {
  provider: Provider;
  enabled: boolean;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  hasPassword: boolean;
  hasSendgridKey: boolean;
  region: string | null;
  configurationSet: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
};

const EMPTY: Settings = {
  provider: "smtp",
  enabled: false,
  fromName: "",
  fromEmail: "",
  replyTo: "",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: "",
  hasPassword: false,
  hasSendgridKey: false,
  region: "us-east-1",
  configurationSet: "",
  lastTestedAt: null,
  lastTestOk: null,
};

const PROVIDER_LABEL: Record<Provider, string> = {
  smtp: "SMTP",
  sendgrid: "SendGrid",
};

// Asistente de correo saliente: el administrador elige entre un servidor SMTP
// (Amazon SES u otro) y SendGrid (API), sin tocar variables de entorno. La
// contraseña y la clave de API se guardan cifradas; "Verificar" comprueba la
// clave de SendGrid sin enviar nada y "Probar envío" manda un correo real.
export default function SmtpEmailPanel() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "check" | null>(null);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/email-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { data?: Settings } | null) => {
        if (!cancelled && payload?.data) {
          setS({ ...EMPTY, ...payload.data });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const field = (key: keyof Settings, value: string | number | boolean) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const submit = async (action: "save" | "test" | "check") => {
    setBusy(action);
    setStatus(null);
    try {
      const response = await fetch("/api/email-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          provider: s.provider,
          enabled: s.enabled,
          fromName: s.fromName,
          fromEmail: s.fromEmail,
          replyTo: s.replyTo,
          smtpHost: s.smtpHost,
          smtpPort: s.smtpPort,
          smtpSecure: s.smtpSecure,
          smtpUsername: s.smtpUsername,
          ...(password ? { smtpPassword: password } : {}),
          ...(apiKey ? { sendgridApiKey: apiKey } : {}),
          region: s.region,
          configurationSet: s.configurationSet,
          ...(action === "test" ? { testRecipient: testTo } : {}),
        }),
      });
      const payload = (await response.json()) as {
        data?: {
          settings: Settings;
          test?: { ok: boolean; detail: string };
          check?: { ok: boolean; detail: string };
        };
        error?: string;
      };
      if (!response.ok) {
        setStatus({ text: payload.error ?? "No fue posible guardar.", error: true });
      } else {
        if (payload.data?.settings) setS({ ...EMPTY, ...payload.data.settings });
        setPassword("");
        setApiKey("");
        if (action === "test" && payload.data?.test) {
          setStatus({ text: payload.data.test.detail, error: !payload.data.test.ok });
        } else if (action === "check" && payload.data?.check) {
          setStatus({ text: payload.data.check.detail, error: !payload.data.check.ok });
        } else {
          setStatus({ text: "Configuración guardada.", error: false });
        }
      }
    } catch {
      setStatus({ text: "No fue posible contactar al servidor.", error: true });
    } finally {
      setBusy(null);
    }
  };

  const isSendgrid = s.provider === "sendgrid";

  return (
    <section className="panel smtp-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CORREO SALIENTE · {PROVIDER_LABEL[s.provider]}</p>
          <h2>Configurar proveedor de correo</h2>
          <p>
            Elige el proveedor y defínelo desde aquí, sin tocar variables del servidor.
            Las credenciales se guardan cifradas. Cuando el envío está habilitado, esta
            configuración tiene prioridad sobre cualquier otra.
          </p>
        </div>
        <label className="smtp-toggle">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => field("enabled", e.target.checked)}
          />
          <span>{s.enabled ? "Envío habilitado" : "Envío deshabilitado"}</span>
        </label>
      </div>

      <div className="email-provider-switch" role="radiogroup" aria-label="Proveedor de correo saliente">
        <button
          type="button"
          role="radio"
          aria-checked={!isSendgrid}
          className="email-provider-option"
          onClick={() => field("provider", "smtp")}
        >
          <span className="service-logo smtp">SMTP</span>
          <strong>Servidor SMTP</strong>
          <span>Amazon SES u otro servidor con usuario y contraseña.</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isSendgrid}
          className="email-provider-option"
          onClick={() => field("provider", "sendgrid")}
        >
          <span className="service-logo sendgrid">SG</span>
          <strong>SendGrid</strong>
          <span>Envío por API con clave; sin límite de destinatarios verificados.</span>
        </button>
      </div>

      <div className="smtp-grid">
        <label>
          Nombre del remitente
          <input value={s.fromName ?? ""} onChange={(e) => field("fromName", e.target.value)} placeholder="Icaza Jammoul Live" />
        </label>
        <label>
          Correo del remitente
          <input type="email" value={s.fromEmail ?? ""} onChange={(e) => field("fromEmail", e.target.value)} placeholder="eventos@tudominio.com" autoComplete="off" />
        </label>

        {isSendgrid ? (
          <>
            <label>
              Clave de API de SendGrid
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={s.hasSendgridKey ? "•••••••• (guardada)" : "SG.xxxxxxxx…"}
                name="icaza-sendgrid-key"
                autoComplete="new-password"
              />
            </label>
            <label>
              Reply-To (opcional)
              <input type="email" value={s.replyTo ?? ""} onChange={(e) => field("replyTo", e.target.value)} placeholder="soporte@tudominio.com" />
            </label>
          </>
        ) : (
          <>
            <label>
              Servidor SMTP (Host)
              <input value={s.smtpHost ?? ""} onChange={(e) => field("smtpHost", e.target.value)} placeholder="email-smtp.us-east-1.amazonaws.com" />
            </label>
            <label>
              Puerto
              <input type="number" value={s.smtpPort ?? 587} onChange={(e) => field("smtpPort", Number(e.target.value))} placeholder="587" />
            </label>
            <label>
              Usuario SMTP
              <input value={s.smtpUsername ?? ""} onChange={(e) => field("smtpUsername", e.target.value)} placeholder="Usuario SMTP del proveedor" name="icaza-smtp-user" autoComplete="off" />
            </label>
            <label>
              Contraseña SMTP
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={s.hasPassword ? "•••••••• (guardada)" : "Contraseña SMTP"} name="icaza-smtp-pass" autoComplete="new-password" />
            </label>
            <label>
              Reply-To (opcional)
              <input type="email" value={s.replyTo ?? ""} onChange={(e) => field("replyTo", e.target.value)} placeholder="soporte@tudominio.com" />
            </label>
            <label>
              Región (opcional)
              <input value={s.region ?? ""} onChange={(e) => field("region", e.target.value)} placeholder="us-east-1" />
            </label>
            <label className="smtp-check">
              <input type="checkbox" checked={s.smtpSecure} onChange={(e) => field("smtpSecure", e.target.checked)} />
              <span>Conexión segura TLS/SSL directa (puerto 465). Déjalo sin marcar para STARTTLS en 587.</span>
            </label>
          </>
        )}
      </div>

      {isSendgrid ? (
        <ol className="email-provider-steps">
          <li>
            En SendGrid, <b>Settings → Sender Authentication → Authenticate Your Domain</b>:
            agrega los registros CNAME que te entrega en el DNS del dominio del remitente
            (por ejemplo <code>{(s.fromEmail ?? "").split("@")[1] || "tudominio.com"}</code>). Sin esto los correos pueden caer en spam.
          </li>
          <li>
            <b>Settings → API Keys → Create API Key</b> con acceso restringido: <b>Mail Send</b> en
            acceso completo. Opcional: <b>Sender Authentication</b> en lectura para que la
            verificación muestre el estado del dominio. Copia la clave (empieza por <code>SG.</code>) y pégala arriba.
          </li>
          <li>Guarda, pulsa <b>Verificar conexión</b> y luego <b>Probar envío</b> a un correo externo.</li>
        </ol>
      ) : (
        <p className="smtp-note">
          La contraseña SMTP suele NO ser la misma que la clave secreta de tu proveedor.
          En Amazon SES se genera en <b>SES → SMTP settings → Create SMTP credentials</b>.
        </p>
      )}

      <div className="smtp-actions">
        <div className="smtp-primary-group">
          <button className="primary-button" disabled={busy !== null} onClick={() => void submit("save")}>
            {busy === "save" ? "Guardando…" : "Guardar configuración"}
          </button>
          {isSendgrid && (
            <button
              className="smtp-secondary"
              disabled={busy !== null || (!apiKey && !s.hasSendgridKey)}
              onClick={() => void submit("check")}
            >
              {busy === "check" ? "Verificando…" : "Verificar conexión"}
            </button>
          )}
        </div>
        <div className="smtp-test">
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="destinatario@empresa.com" />
          <button disabled={busy !== null || !testTo.trim()} onClick={() => void submit("test")}>
            {busy === "test" ? "Enviando…" : "Probar envío"}
          </button>
        </div>
      </div>

      {status && (
        <p className={`smtp-status ${status.error ? "error" : "ok"}`} role="status">
          {status.error ? "⚠ " : "✓ "}
          {status.text}
        </p>
      )}
      {s.lastTestedAt && (
        <p className="smtp-lasttest">
          Última prueba: {new Date(s.lastTestedAt).toLocaleString("es-CO", { timeZone: PLATFORM_TIMEZONE })} ·{" "}
          {s.lastTestOk ? "exitosa" : "fallida"}
        </p>
      )}
    </section>
  );
}
