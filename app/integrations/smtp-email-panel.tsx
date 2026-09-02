"use client";

import { useEffect, useState } from "react";

type Settings = {
  provider: string;
  enabled: boolean;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  hasPassword: boolean;
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
  region: "us-east-1",
  configurationSet: "",
  lastTestedAt: null,
  lastTestOk: null,
};

// Asistente de correo saliente por SMTP, configurable por el administrador sin
// tocar variables de entorno. La contraseña se guarda cifrada; el envío de
// prueba usa la configuración guardada.
export default function SmtpEmailPanel() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [password, setPassword] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
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

  const submit = async (action: "save" | "test") => {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/email-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          enabled: s.enabled,
          fromName: s.fromName,
          fromEmail: s.fromEmail,
          replyTo: s.replyTo,
          smtpHost: s.smtpHost,
          smtpPort: s.smtpPort,
          smtpSecure: s.smtpSecure,
          smtpUsername: s.smtpUsername,
          ...(password ? { smtpPassword: password } : {}),
          region: s.region,
          configurationSet: s.configurationSet,
          ...(action === "test" ? { testRecipient: testTo } : {}),
        }),
      });
      const payload = (await response.json()) as {
        data?: { settings: Settings; test?: { ok: boolean; detail: string } };
        error?: string;
      };
      if (!response.ok) {
        setStatus({ text: payload.error ?? "No fue posible guardar.", error: true });
      } else {
        if (payload.data?.settings) setS({ ...EMPTY, ...payload.data.settings });
        setPassword("");
        if (action === "test" && payload.data?.test) {
          setStatus({ text: payload.data.test.detail, error: !payload.data.test.ok });
        } else {
          setStatus({ text: "Configuración guardada.", error: false });
        }
      }
    } catch {
      setStatus({ text: "No fue posible contactar al servidor.", error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel smtp-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CORREO SALIENTE · SMTP</p>
          <h2>Configurar servidor de correo</h2>
          <p>
            Define el servidor SMTP desde aquí, sin tocar variables del servidor.
            La contraseña se guarda cifrada. Cuando el envío está habilitado, esta
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

      <div className="smtp-grid">
        <label>
          Nombre del remitente
          <input value={s.fromName ?? ""} onChange={(e) => field("fromName", e.target.value)} placeholder="Icaza Live" />
        </label>
        <label>
          Correo del remitente
          <input type="email" value={s.fromEmail ?? ""} onChange={(e) => field("fromEmail", e.target.value)} placeholder="eventos@tudominio.com" autoComplete="off" />
        </label>
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
      </div>

      <p className="smtp-note">
        La contraseña SMTP suele NO ser la misma que la clave secreta de tu proveedor.
        En Amazon SES se genera en <b>SES → SMTP settings → Create SMTP credentials</b>.
      </p>

      <div className="smtp-actions">
        <button className="primary-button" disabled={busy} onClick={() => void submit("save")}>
          {busy ? "Guardando…" : "Guardar configuración"}
        </button>
        <div className="smtp-test">
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="destinatario@empresa.com" />
          <button disabled={busy || !testTo.trim()} onClick={() => void submit("test")}>
            {busy ? "Enviando…" : "Probar envío"}
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
          Última prueba: {new Date(s.lastTestedAt).toLocaleString("es-CO")} ·{" "}
          {s.lastTestOk ? "exitosa" : "fallida"}
        </p>
      )}
    </section>
  );
}
