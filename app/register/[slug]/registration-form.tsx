"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import PublicBrandIdentity from "@/app/components/public-brand";
import type { PublicBrand } from "@/lib/brand-config";
import type { RegistrationFieldDefinition } from "@/lib/registration-fields";

type PublicEvent = {
  title: string;
  slug: string;
  description: string | null;
  format: "live" | "simulated" | "hybrid";
  status: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  registrationOpen: boolean;
};

function formatStableDateTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value.replace(/\s+/g, " ") ?? "";
  return `${value("day")} de ${value("month")} de ${value("year")} · ${value("hour")}:${value("minute")} ${value("dayPeriod")}`.trim();
}

export default function RegistrationForm({
  event,
  brand,
  fields,
  legalDocuments,
}: {
  event: PublicEvent;
  brand: PublicBrand;
  fields: RegistrationFieldDefinition[];
  legalDocuments: {
    privacy: { id: string; title: string; version: number };
    terms: { id: string; title: string; version: number };
  };
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [accessUrl, setAccessUrl] = useState("");
  const [manageUrl, setManageUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState("");
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const registrationAvailable =
    event.registrationOpen &&
    event.status !== "cancelled" &&
    event.status !== "completed";

  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(formEvent.currentTarget);
    const customResponses = Object.fromEntries(
      fields.map((field) => [
        field.id,
        field.type === "checkbox"
          ? form.get(`custom-${field.id}`) === "on"
          : form.get(`custom-${field.id}`),
      ]),
    );

    const response = await fetch(`/api/public/events/${event.slug}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        company: form.get("company"),
        jobTitle: form.get("jobTitle"),
        phone: form.get("phone"),
        privacyConsent: form.get("privacyConsent") === "on",
        termsConsent: form.get("termsConsent") === "on",
        marketingConsent: form.get("marketingConsent") === "on",
        privacyDocumentId: legalDocuments.privacy.id,
        termsDocumentId: legalDocuments.terms.id,
        customResponses,
      }),
    });
    const payload = (await response.json()) as {
      data?: {
        accessUrl?: string;
        manageUrl?: string;
        calendarUrl?: string;
      };
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "No fue posible completar el registro.");
      setSubmitting(false);
      return;
    }

    setAccessUrl(payload.data?.accessUrl ?? "");
    setManageUrl(payload.data?.manageUrl ?? "");
    setCalendarUrl(payload.data?.calendarUrl ?? "");
    setConfirmed(true);
    setSubmitting(false);
  };

  return (
    <main
      className="registration-shell branded-registration"
      style={{
        "--brand-primary": brand.primaryColor,
        "--brand-accent": brand.accentColor,
        "--brand-background": brand.backgroundColor,
      } as CSSProperties}
    >
      <section className={`registration-hero ${event.format}`}>
        <PublicBrandIdentity brand={brand} />
        <div className="registration-event">
          <div className="public-badges">
            <span>{event.format === "live" ? "EVENTO EN VIVO" : event.format === "hybrid" ? "EVENTO HÍBRIDO" : "EVENTO SIMULADO"}</span>
            <i>Acceso online</i>
          </div>
          <h1>{event.title}</h1>
          <p>{event.description ?? "Una experiencia diseñada para aprender, conectar e interactuar."}</p>
          <div className="public-event-details">
            <div><span>◷</span><p><small>FECHA Y HORA</small><b>{formatStableDateTime(start, event.timezone)}</b></p></div>
            <div><span>⌛</span><p><small>DURACIÓN</small><b>{Math.round((end.getTime() - start.getTime()) / 60000)} minutos</b></p></div>
            <div><span>◎</span><p><small>MODALIDAD</small><b>{event.format === "hybrid" ? "Presencial + online" : "100% online"}</b></p></div>
          </div>
        </div>
        <p className="public-footer">Powered by {brand.organizationName} · {brand.footerText}</p>
      </section>

      <section className="registration-panel">
        <div className="registration-card">
          {!registrationAvailable ? (
            <div className="registration-closed">
              <span>⌁</span>
              <p className="eyebrow">REGISTRO NO DISPONIBLE</p>
              <h2>Las inscripciones están cerradas</h2>
              <p>El organizador aún no ha abierto el registro o el evento ya finalizó.</p>
            </div>
          ) : confirmed ? (
            <div className="registration-success">
              <span>✓</span>
              <p className="eyebrow">REGISTRO COMPLETADO</p>
              <h2>¡Tu lugar está reservado!</h2>
              <p>Registramos correctamente tus datos para <b>{event.title}</b>.</p>
              <div><small>Próximo paso</small><p>Tu confirmación quedó registrada en la cola local. Conserva tu enlace individual para ingresar al lobby y participar durante el evento.</p></div>
              <div className="registration-success-actions">
                {accessUrl && <Link className="login-submit registration-room-link" href={accessUrl}>Entrar a la sala del evento <span>→</span></Link>}
                {manageUrl && <Link className="registration-manage-link" href={manageUrl}>Gestionar mi inscripción</Link>}
                {calendarUrl && <a className="registration-manage-link" href={calendarUrl}>Añadir al calendario (.ics)</a>}
              </div>
            </div>
          ) : (
            <>
              <p className="eyebrow">RESERVA TU LUGAR</p>
              <h2>Regístrate al evento</h2>
              <p className="registration-intro">Completa tus datos. Los campos marcados son obligatorios.</p>
              <form className="public-form" onSubmit={submit}>
                <label>Nombre completo *<input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Tu nombre y apellido" /></label>
                <label>Correo electrónico *<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="nombre@empresa.com" /></label>
                <div className="public-form-row">
                  <label>Empresa<input name="company" maxLength={150} autoComplete="organization" placeholder="Nombre de la empresa" /></label>
                  <label>Cargo<input name="jobTitle" maxLength={150} autoComplete="organization-title" placeholder="Tu cargo" /></label>
                </div>
                <label>Teléfono<input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="+57 300 000 0000" /></label>
                {fields.length > 0 && (
                  <div className="custom-registration-fields">
                    <p>INFORMACIÓN ADICIONAL</p>
                    {fields.map((field) =>
                      field.type === "checkbox" ? (
                        <label className="consent-row custom-field-check" key={field.id}>
                          <input
                            name={`custom-${field.id}`}
                            type="checkbox"
                            required={field.required}
                          />
                          <span>
                            {field.label}
                            {field.required ? " *" : ""}
                            {field.helpText && <small>{field.helpText}</small>}
                          </span>
                        </label>
                      ) : (
                        <label key={field.id}>
                          {field.label}{field.required ? " *" : ""}
                          {field.type === "textarea" ? (
                            <textarea
                              name={`custom-${field.id}`}
                              required={field.required}
                              maxLength={3000}
                              placeholder={field.placeholder ?? ""}
                            />
                          ) : field.type === "select" ? (
                            <select
                              name={`custom-${field.id}`}
                              required={field.required}
                              defaultValue=""
                            >
                              <option value="">Selecciona una opción</option>
                              {field.options.map((option) => (
                                <option value={option} key={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              name={`custom-${field.id}`}
                              required={field.required}
                              maxLength={500}
                              placeholder={field.placeholder ?? ""}
                            />
                          )}
                          {field.helpText && <small className="field-help">{field.helpText}</small>}
                        </label>
                      ),
                    )}
                  </div>
                )}
                <label className="consent-row">
                  <input name="privacyConsent" type="checkbox" required />
                  <span>
                    Acepto el tratamiento de mis datos según la{" "}
                    <Link href="/privacy#privacy" target="_blank">
                      {legalDocuments.privacy.title} v{legalDocuments.privacy.version}
                    </Link>. *
                  </span>
                </label>
                <label className="consent-row">
                  <input name="termsConsent" type="checkbox" required />
                  <span>
                    Acepto los{" "}
                    <Link href="/privacy#terms" target="_blank">
                      {legalDocuments.terms.title} v{legalDocuments.terms.version}
                    </Link>. *
                  </span>
                </label>
                <label className="consent-row optional"><input name="marketingConsent" type="checkbox" /><span>Quiero recibir invitaciones a próximos eventos y contenidos relacionados.</span></label>
                {error && <div className="login-error" role="alert">ⓘ {error}</div>}
                <button className="login-submit" disabled={submitting}>{submitting ? "Registrando…" : brand.registrationButtonLabel}<span>→</span></button>
              </form>
              <p className="form-privacy">
                Guardamos prueba de las versiones aceptadas. Puedes ejercer tus
                derechos desde el <Link href="/privacy#request">Centro de privacidad</Link>.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
