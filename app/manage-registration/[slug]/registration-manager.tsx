"use client";

import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import PublicBrandIdentity from "@/app/components/public-brand";
import type { PublicBrand } from "@/lib/brand-config";
import FeedbackCard from "./feedback-card";
import type { RegistrationFieldDefinition } from "@/lib/registration-fields";

type ManagementData = {
  registration: {
    id: string;
    status: "registered" | "confirmed" | "attended" | "absent" | "cancelled";
    name: string;
    email: string;
    company: string | null;
    jobTitle: string | null;
    phone: string | null;
    marketingConsent: boolean;
    registeredAt: string;
  };
  event: {
    title: string;
    slug: string;
    status: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    registrationOpen: boolean;
    selfServiceClosesAt: string;
    selfServiceClosed: boolean;
  };
  fields: RegistrationFieldDefinition[];
  responses: Record<string, string>;
};

function formatDate(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts
      .find((item) => item.type === type)
      ?.value.replace(/\s+/g, " ") ?? "";
  return `${part("weekday")}, ${part("day")} de ${part("month")} de ${part("year")}, ${part("hour")}:${part("minute")} ${part("dayPeriod")}`.trim();
}

export default function RegistrationManager({
  eventShell,
  accessToken,
  brand,
}: {
  eventShell: {
    title: string;
    slug: string;
    startsAt: string;
    timezone: string;
  };
  accessToken: string | null;
  brand: PublicBrand;
}) {
  const [data, setData] = useState<ManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const headers = accessToken
    ? { authorization: `Bearer ${accessToken}` }
    : undefined;
  const encodedToken = encodeURIComponent(accessToken ?? "");

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/public/events/${eventShell.slug}/registration`,
        { headers, cache: "no-store" },
      );
      const payload = (await response.json()) as {
        data?: ManagementData;
        error?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(
          payload.error ?? "No fue posible consultar la inscripción.",
        );
      }
      setData(payload.data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible consultar la inscripción.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/events/${eventShell.slug}/registration`, {
      headers: accessToken
        ? { authorization: `Bearer ${accessToken}` }
        : undefined,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: ManagementData;
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(
            payload.error ?? "No fue posible consultar la inscripción.",
          );
        }
        if (!cancelled) {
          setData(payload.data);
          setError("");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No fue posible consultar la inscripción.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, eventShell.slug]);

  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!data) return;
    setSaving(true);
    setError("");
    setNotice("");
    const form = new FormData(formEvent.currentTarget);
    const customResponses = Object.fromEntries(
      data.fields.map((field) => [
        field.id,
        field.type === "checkbox"
          ? form.get(`custom-${field.id}`) === "on"
          : form.get(`custom-${field.id}`),
      ]),
    );
    const response = await fetch(
      `/api/public/events/${eventShell.slug}/registration`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(headers ?? {}),
        },
        body: JSON.stringify({
          name: form.get("name"),
          company: form.get("company"),
          jobTitle: form.get("jobTitle"),
          phone: form.get("phone"),
          marketingConsent: form.get("marketingConsent") === "on",
          customResponses,
        }),
      },
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "No fue posible guardar los cambios.");
      setSaving(false);
      return;
    }
    setNotice("Tus datos se actualizaron correctamente.");
    await load();
    setSaving(false);
  };

  const changeStatus = async (action: "cancel" | "reactivate") => {
    if (
      action === "cancel" &&
      !window.confirm(
        "¿Cancelar tu inscripción? El enlace de acceso a la sala dejará de funcionar.",
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const response = await fetch(
      `/api/public/events/${eventShell.slug}/registration`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(headers ?? {}),
        },
        body: JSON.stringify({ action }),
      },
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "No fue posible cambiar la inscripción.");
      setSaving(false);
      return;
    }
    setNotice(
      action === "cancel"
        ? "Tu inscripción fue cancelada."
        : "Tu inscripción volvió a estar activa.",
    );
    await load();
    setSaving(false);
  };

  const brandStyle = {
    "--brand-primary": brand.primaryColor,
    "--brand-accent": brand.accentColor,
    "--brand-background": brand.backgroundColor,
  } as CSSProperties;

  return (
    <main
      className="registration-manager-shell branded-registration"
      style={brandStyle}
    >
      <header className="registration-manager-header">
        <PublicBrandIdentity brand={brand} />
        <Link href={`/register/${eventShell.slug}`}>Ver evento</Link>
      </header>
      <section className="registration-manager-grid">
        <aside>
          <p className="eyebrow">MI INSCRIPCIÓN</p>
          <h1>{eventShell.title}</h1>
          <p>
            {formatDate(eventShell.startsAt, eventShell.timezone)}
          </p>
          <div className="management-quick-actions">
            {data?.registration.status !== "cancelled" && accessToken && (
              <>
                <Link href={`/room/${eventShell.slug}?access=${encodedToken}`}>
                  Entrar a la sala <span>→</span>
                </Link>
                <a
                  href={`/api/public/events/${eventShell.slug}/calendar?access=${encodedToken}`}
                >
                  Descargar calendario <span>↓</span>
                </a>
              </>
            )}
          </div>
          <small>
            Este enlace es personal. No lo compartas con otras personas.
          </small>
          {accessToken && data?.registration.status !== "cancelled" && (
            <FeedbackCard eventSlug={eventShell.slug} accessToken={accessToken} />
          )}
        </aside>

        <div className="registration-manager-card">
          {loading ? (
            <div className="management-loading">Consultando tu inscripción…</div>
          ) : error && !data ? (
            <div className="registration-closed">
              <span>!</span>
              <h2>Enlace no disponible</h2>
              <p>{error}</p>
            </div>
          ) : data?.registration.status === "cancelled" ? (
            <div className="registration-cancelled">
              <span>✓</span>
              <p className="eyebrow">INSCRIPCIÓN CANCELADA</p>
              <h2>Tu lugar fue liberado</h2>
              <p>
                Puedes reactivar la inscripción mientras el registro continúe
                abierto y haya capacidad disponible.
              </p>
              {notice && <div className="detail-message">{notice}</div>}
              {error && <div className="login-error">ⓘ {error}</div>}
              {data.event.selfServiceClosed && (
                <div className="login-error">
                  ⓘ El plazo para gestionar esta inscripción ya cerró.
                </div>
              )}
              <button
                className="login-submit"
                disabled={
                  saving ||
                  !data.event.registrationOpen ||
                  data.event.selfServiceClosed
                }
                onClick={() => void changeStatus("reactivate")}
              >
                {saving ? "Reactivando…" : "Reactivar inscripción"}
                <span>→</span>
              </button>
            </div>
          ) : data ? (
            <>
              <p className="eyebrow">DATOS DEL ASISTENTE</p>
              <h2>Gestiona tu inscripción</h2>
              <p className="registration-intro">
                Actualiza tus datos o descarga la invitación del calendario.
              </p>
              {data.event.selfServiceClosed ? (
                <div className="login-error">
                  ⓘ El plazo para editar o cancelar cerró el{" "}
                  {formatDate(data.event.selfServiceClosesAt, data.event.timezone)}.
                  Contacta al equipo del evento si necesitas un cambio.
                </div>
              ) : (
                data.event.selfServiceClosesAt &&
                new Date(data.event.selfServiceClosesAt).getTime() <
                  new Date(data.event.startsAt).getTime() && (
                  <p className="registration-intro">
                    Puedes editar o cancelar hasta el{" "}
                    {formatDate(data.event.selfServiceClosesAt, data.event.timezone)}.
                  </p>
                )
              )}
              {notice && <div className="detail-message">{notice}</div>}
              {error && <div className="login-error">ⓘ {error}</div>}
              <form className="public-form" onSubmit={submit}>
                <label>
                  Nombre completo *
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={data.registration.name}
                  />
                </label>
                <label>
                  Correo electrónico
                  <input value={data.registration.email} disabled />
                  <small className="field-help">
                    El correo identifica tu acceso y no puede modificarse aquí.
                  </small>
                </label>
                <div className="public-form-row">
                  <label>
                    Empresa
                    <input
                      name="company"
                      maxLength={150}
                      defaultValue={data.registration.company ?? ""}
                    />
                  </label>
                  <label>
                    Cargo
                    <input
                      name="jobTitle"
                      maxLength={150}
                      defaultValue={data.registration.jobTitle ?? ""}
                    />
                  </label>
                </div>
                <label>
                  Teléfono
                  <input
                    name="phone"
                    maxLength={40}
                    defaultValue={data.registration.phone ?? ""}
                  />
                </label>
                {data.fields.map((field) =>
                  field.type === "checkbox" ? (
                    <label
                      className="consent-row custom-field-check"
                      key={field.id}
                    >
                      <input
                        name={`custom-${field.id}`}
                        type="checkbox"
                        required={field.required}
                        defaultChecked={data.responses[field.id] === "true"}
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
                          defaultValue={data.responses[field.id] ?? ""}
                          placeholder={field.placeholder ?? ""}
                        />
                      ) : field.type === "select" ? (
                        <select
                          name={`custom-${field.id}`}
                          required={field.required}
                          defaultValue={data.responses[field.id] ?? ""}
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
                          defaultValue={data.responses[field.id] ?? ""}
                          placeholder={field.placeholder ?? ""}
                        />
                      )}
                      {field.helpText && <small className="field-help">{field.helpText}</small>}
                    </label>
                  ),
                )}
                <label className="consent-row optional">
                  <input
                    name="marketingConsent"
                    type="checkbox"
                    defaultChecked={data.registration.marketingConsent}
                  />
                  <span>
                    Quiero recibir invitaciones a próximos eventos y contenidos
                    relacionados.
                  </span>
                </label>
                <button
                  className="login-submit"
                  disabled={saving || data.event.selfServiceClosed}
                >
                  {saving ? "Guardando…" : "Guardar cambios"}
                  <span>→</span>
                </button>
              </form>
              <div className="management-danger-zone">
                <div>
                  <b>Cancelar inscripción</b>
                  <p>Libera tu lugar e invalida el acceso a la sala.</p>
                </div>
                <button
                  disabled={saving || data.event.selfServiceClosed}
                  onClick={() => void changeStatus("cancel")}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
