"use client";

import { useEffect, useState } from "react";

type PasswordStatus = {
  expiresAt: string;
  daysUntilExpiry: number;
  expired: boolean;
  expiresSoon: boolean;
};

export default function AccountSecurity() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PasswordStatus | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.data?.passwordStatus) {
          setStatus(payload.data.passwordStatus as PasswordStatus);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status?.expired && !autoOpened) {
      setAutoOpened(true);
      setOpen(true);
    }
  }, [status, autoOpened]);

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
