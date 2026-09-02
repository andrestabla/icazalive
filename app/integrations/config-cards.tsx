"use client";

import { useEffect, useState } from "react";
import SmtpEmailPanel from "./smtp-email-panel";
import GoogleSsoPanel from "./google-sso-panel";

type Modal = "smtp" | "google" | null;

// Tarjetas de Correo SMTP y Google SSO para la grilla de integraciones. Toda la
// configuración se hace en un modal, igual que los demás asistentes.
export default function ExtraIntegrationCards() {
  const [modal, setModal] = useState<Modal>(null);
  const [smtpEnabled, setSmtpEnabled] = useState<boolean | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState<boolean | null>(null);

  const refresh = () => {
    fetch("/api/email-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { data?: { enabled: boolean } } | null) => setSmtpEnabled(Boolean(p?.data?.enabled)))
      .catch(() => setSmtpEnabled(false));
    fetch("/api/integrations/sso-google", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { data?: { enabled: boolean } } | null) => setSsoEnabled(Boolean(p?.data?.enabled)))
      .catch(() => setSsoEnabled(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const close = () => {
    setModal(null);
    refresh();
  };

  const badge = (enabled: boolean | null) =>
    enabled === null ? (
      <i className="pending">Cargando…</i>
    ) : enabled ? (
      <i className="connected">Habilitado</i>
    ) : (
      <i className="pending">Deshabilitado</i>
    );

  return (
    <>
      <article className="panel setup-wizard-card smtp-wizard-card">
        <header>
          <span className="service-logo smtp">SMTP</span>
          {badge(smtpEnabled)}
        </header>
        <p className="eyebrow">CORREO SALIENTE</p>
        <h3>Servidor SMTP</h3>
        <p>
          Configura host, puerto, usuario y contraseña desde aquí. Con prioridad
          sobre las variables del servidor.
        </p>
        <div className="wizard-card-progress">
          <span style={{ width: smtpEnabled ? "100%" : "0%" }} />
        </div>
        <footer>
          <small>{smtpEnabled ? "Envío activo" : "Sin configurar"}</small>
          <button onClick={() => setModal("smtp")}>Configurar →</button>
        </footer>
      </article>

      <article className="panel setup-wizard-card google-wizard-card">
        <header>
          <span className="service-logo google">G</span>
          {badge(ssoEnabled)}
        </header>
        <p className="eyebrow">ACCESO CON GOOGLE</p>
        <h3>Inicio de sesión con Google</h3>
        <p>
          Credenciales de Google Cloud, dominio permitido y rol de las cuentas
          nuevas. El client secret se guarda cifrado.
        </p>
        <div className="wizard-card-progress">
          <span style={{ width: ssoEnabled ? "100%" : "0%" }} />
        </div>
        <footer>
          <small>{ssoEnabled ? "SSO activo" : "Sin configurar"}</small>
          <button onClick={() => setModal("google")}>Configurar →</button>
        </footer>
      </article>

      {modal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            className="modal setup-wizard-modal config-modal"
            role="dialog"
            aria-modal="true"
          >
            <button className="modal-close" aria-label="Cerrar" onClick={close}>
              ×
            </button>
            {modal === "smtp" ? <SmtpEmailPanel /> : <GoogleSsoPanel />}
          </section>
        </div>
      )}
    </>
  );
}
