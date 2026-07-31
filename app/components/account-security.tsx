"use client";

import { useEffect, useState } from "react";
import { invalidateUserTimezone } from "@/lib/use-user-timezone";

type PasswordStatus = {
  expiresAt: string;
  daysUntilExpiry: number;
  expired: boolean;
  expiresSoon: boolean;
};

const TIMEZONE_CHOICES = [
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "America/Guayaquil",
  "America/Panama",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/London",
  "UTC",
];

export default function AccountSecurity() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PasswordStatus | null>(null);
  const [, setAutoOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timezone, setTimezone] = useState<string>("");
  const [timezoneNotice, setTimezoneNotice] = useState("");
  const [mfa, setMfa] = useState<{ enabled: boolean; backupCodesRemaining: number } | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[] | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaNotice, setMfaNotice] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  const refreshMfa = () => {
    fetch("/api/auth/mfa")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.data) setMfa(payload.data);
      })
      .catch(() => undefined);
  };

  const mfaAction = async (action: "start" | "activate" | "disable") => {
    setMfaBusy(true);
    setMfaNotice("");
    const response = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, code: mfaCode || undefined }),
    });
    const payload = (await response.json()) as {
      data?: { secret?: string; otpauth?: string; backupCodes?: string[]; enabled?: boolean };
      error?: string;
    };
    setMfaBusy(false);
    if (!response.ok || !payload.data) {
      setMfaNotice(payload.error ?? "No fue posible completar la acción.");
      return;
    }
    if (action === "start" && payload.data.secret) {
      setMfaSetup({ secret: payload.data.secret, otpauth: payload.data.otpauth! });
      setMfaCode("");
    }
    if (action === "activate" && payload.data.backupCodes) {
      setMfaBackupCodes(payload.data.backupCodes);
      setMfaSetup(null);
      setMfaCode("");
      setMfaNotice("Segundo factor activado. Guarda tus códigos de respaldo.");
      refreshMfa();
    }
    if (action === "disable") {
      setMfaBackupCodes(null);
      setMfaCode("");
      setMfaNotice("Segundo factor desactivado.");
      refreshMfa();
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.data) return;
        if (payload.data.passwordStatus) {
          const passwordStatus = payload.data.passwordStatus as PasswordStatus;
          setStatus(passwordStatus);
          if (passwordStatus.expired) {
            // Aviso automático: abre el modal una sola vez al detectar expiración.
            setAutoOpened((alreadyOpened) => {
              if (!alreadyOpened) setOpen(true);
              return true;
            });
          }
        }
        setTimezone((payload.data.timezone as string | null) ?? "");
        refreshMfa();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const saveTimezone = async (value: string) => {
    setTimezone(value);
    setTimezoneNotice("");
    const response = await fetch("/api/auth/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: value || null }),
    });
    if (response.ok) {
      invalidateUserTimezone(value || null);
      setTimezoneNotice(
        value
          ? `Las fechas administrativas se mostrarán en ${value.replaceAll("_", " ")}.`
          : "Se usará la zona horaria del navegador.",
      );
    } else {
      const payload = (await response.json()) as { error?: string };
      setTimezoneNotice(payload.error ?? "No se pudo guardar la preferencia.");
    }
  };


  async function submit(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    setSaving(true);
    setError(null);
    const fields = new FormData(form.currentTarget);
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: fields.get("currentPassword"),
        newPassword: fields.get("newPassword"),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error ?? "No se pudo cambiar la contraseña.");
      return;
    }
    setSuccess(true);
    setStatus((previous) =>
      previous
        ? { ...previous, expired: false, expiresSoon: false, daysUntilExpiry: 180 }
        : previous,
    );
  }

  const needsAttention = Boolean(status && (status.expired || status.expiresSoon));

  return (
    <>
      <button
        type="button"
        className="account-security-button"
        title="Seguridad de la cuenta"
        aria-label="Seguridad de la cuenta"
        onClick={() => {
          setOpen(true);
          setSuccess(false);
          setError(null);
        }}
      >
        ⚿{needsAttention && <i aria-hidden />}
      </button>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="account-security-title">
          <div className="modal account-security-modal">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
            <div className="modal-icon">⚿</div>
            <h2 id="account-security-title">Seguridad de la cuenta</h2>
            {status?.expired && (
              <p className="account-password-alert error">
                Tu contraseña superó los 180 días de vigencia. Cámbiala ahora para mantener la cuenta protegida.
              </p>
            )}
            {status?.expiresSoon && !status.expired && (
              <p className="account-password-alert warning">
                Tu contraseña vence en {status.daysUntilExpiry} {status.daysUntilExpiry === 1 ? "día" : "días"}. Te recomendamos renovarla.
              </p>
            )}
            <label className="timezone-preference">
              Zona horaria para fechas administrativas
              <select
                value={timezone}
                onChange={(input) => void saveTimezone(input.target.value)}
              >
                <option value="">Automática (zona del navegador)</option>
                {TIMEZONE_CHOICES.map((zone) => (
                  <option value={zone} key={zone}>{zone.replaceAll("_", " ")}</option>
                ))}
              </select>
              {timezoneNotice && <small role="status">{timezoneNotice}</small>}
            </label>
            <div className="mfa-section">
              <b>Verificación en dos pasos (TOTP)</b>
              {mfa?.enabled && !mfaBackupCodes && (
                <>
                  <p className="account-password-alert success">
                    Activa · {mfa.backupCodesRemaining} código{mfa.backupCodesRemaining === 1 ? "" : "s"} de respaldo disponibles.
                  </p>
                  <div className="mfa-inline">
                    <input
                      value={mfaCode}
                      onChange={(input) => setMfaCode(input.target.value)}
                      placeholder="Código para confirmar"
                      inputMode="numeric"
                      aria-label="Código para desactivar el segundo factor"
                    />
                    <button disabled={mfaBusy || !mfaCode} onClick={() => void mfaAction("disable")}>Desactivar</button>
                  </div>
                </>
              )}
              {!mfa?.enabled && !mfaSetup && (
                <div className="mfa-inline">
                  <p>Protege tu cuenta con una app autenticadora.</p>
                  <button disabled={mfaBusy} onClick={() => void mfaAction("start")}>Configurar</button>
                </div>
              )}
              {mfaSetup && (
                <div className="mfa-setup">
                  <p>1. Agrega esta clave en tu app autenticadora (entrada manual):</p>
                  <code>{mfaSetup.secret}</code>
                  <p>2. Ingresa el código de 6 dígitos que genera la app:</p>
                  <div className="mfa-inline">
                    <input
                      value={mfaCode}
                      onChange={(input) => setMfaCode(input.target.value)}
                      placeholder="000000"
                      inputMode="numeric"
                      maxLength={6}
                      aria-label="Código de verificación de la app"
                    />
                    <button disabled={mfaBusy || mfaCode.length !== 6} onClick={() => void mfaAction("activate")}>Activar</button>
                  </div>
                </div>
              )}
              {mfaBackupCodes && (
                <div className="mfa-backup-codes">
                  <p>Guarda estos códigos de respaldo — cada uno sirve una sola vez y no volverán a mostrarse:</p>
                  <code>{mfaBackupCodes.join("  ")}</code>
                </div>
              )}
              {mfaNotice && <small role="status">{mfaNotice}</small>}
            </div>
            {!success ? (
              <>
                <p>La política exige renovar la contraseña cada seis meses. Debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.</p>
                <form className="event-form" onSubmit={submit}>
                  <label>
                    Contraseña actual
                    <input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" />
                  </label>
                  <label>
                    Nueva contraseña
                    <input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
                  </label>
                  {error && <p className="form-error">{error}</p>}
                  <button className="primary-button submit-button" disabled={saving}>
                    {saving ? "Guardando…" : "Cambiar contraseña"}
                  </button>
                </form>
              </>
            ) : (
              <p className="account-password-alert success">
                Contraseña actualizada. Tus otras sesiones abiertas se cerraron por seguridad.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
