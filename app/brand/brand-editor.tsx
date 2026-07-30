"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import PublicBrandIdentity from "@/app/components/public-brand";
import { DEFAULT_BRAND, type PublicBrand } from "@/lib/brand-config";

const palettes = [
  {
    name: "Icaza",
    primaryColor: "#24194F",
    accentColor: "#6946E8",
    backgroundColor: "#FBFAFC",
  },
  {
    name: "Océano",
    primaryColor: "#123A4A",
    accentColor: "#1686A0",
    backgroundColor: "#F4FAFB",
  },
  {
    name: "Bosque",
    primaryColor: "#173D32",
    accentColor: "#268A6B",
    backgroundColor: "#F4FAF7",
  },
  {
    name: "Terracota",
    primaryColor: "#4D2921",
    accentColor: "#C36D43",
    backgroundColor: "#FCF7F4",
  },
];

function brandVariables(brand: PublicBrand) {
  return {
    "--brand-primary": brand.primaryColor,
    "--brand-accent": brand.accentColor,
    "--brand-background": brand.backgroundColor,
  } as CSSProperties;
}

export default function BrandEditor({
  initialBrand,
}: {
  initialBrand: PublicBrand;
}) {
  const [brand, setBrand] = useState(initialBrand);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const update = <Key extends keyof PublicBrand>(
    key: Key,
    value: PublicBrand[Key],
  ) => setBrand((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/brand", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(brand),
    });
    const payload = (await response.json()) as {
      data?: PublicBrand;
      error?: string;
    };
    if (response.ok && payload.data) {
      setBrand({
        organizationName: payload.data.organizationName,
        markText: payload.data.markText,
        logoUrl: payload.data.logoUrl,
        primaryColor: payload.data.primaryColor,
        accentColor: payload.data.accentColor,
        backgroundColor: payload.data.backgroundColor,
        registrationButtonLabel: payload.data.registrationButtonLabel,
        footerText: payload.data.footerText,
      });
      setMessage("La identidad pública quedó guardada localmente.");
    } else {
      setError(payload.error ?? "No fue posible guardar la marca.");
    }
    setSaving(false);
  };

  return (
    <>
      <header className="module-header brand-module-header">
        <div>
          <p className="eyebrow">IDENTIDAD VISUAL</p>
          <h1>Marca</h1>
          <p>Personaliza la experiencia que verán tus participantes.</p>
        </div>
        <Link
          href="/register/liderazgo-que-transforma"
          target="_blank"
          className="secondary-action link-button"
        >
          Abrir página pública ↗
        </Link>
      </header>

      {message && <div className="detail-message" role="status">{message}</div>}
      {error && <div className="brand-error" role="alert">ⓘ {error}</div>}

      <div className="brand-editor-grid">
        <form className="panel brand-settings-panel" onSubmit={save}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CONFIGURACIÓN</p>
              <h2>Identidad pública</h2>
              <p>Estos cambios se aplican al registro y a la sala.</p>
            </div>
          </div>

          <div className="brand-form-section">
            <h3>Nombre y símbolo</h3>
            <div className="brand-field-row">
              <label>
                Nombre de la organización
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={brand.organizationName}
                  onChange={(input) => update("organizationName", input.target.value)}
                />
              </label>
              <label>
                Monograma
                <input
                  required
                  minLength={1}
                  maxLength={3}
                  value={brand.markText}
                  onChange={(input) => update("markText", input.target.value)}
                />
              </label>
            </div>
            <label>
              URL del logo <small>Opcional · HTTPS recomendado</small>
              <input
                type="url"
                maxLength={500}
                placeholder="https://empresa.com/logo.png"
                value={brand.logoUrl ?? ""}
                onChange={(input) => update("logoUrl", input.target.value || null)}
              />
            </label>
            <p className="brand-storage-note">
              Para mantener el proyecto portable a Replit, guardamos la URL del
              logo y no archivos dentro del servidor local.
            </p>
          </div>

          <div className="brand-form-section">
            <h3>Paleta</h3>
            <div className="brand-palettes">
              {palettes.map((palette) => (
                <button
                  type="button"
                  key={palette.name}
                  onClick={() =>
                    setBrand((current) => ({ ...current, ...palette }))
                  }
                >
                  <span>
                    <i style={{ background: palette.primaryColor }} />
                    <i style={{ background: palette.accentColor }} />
                    <i style={{ background: palette.backgroundColor }} />
                  </span>
                  {palette.name}
                </button>
              ))}
            </div>
            <div className="brand-color-grid">
              {[
                ["primaryColor", "Color principal"],
                ["accentColor", "Color de acento"],
                ["backgroundColor", "Fondo público"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <span>
                    <input
                      type="color"
                      value={brand[key as keyof Pick<PublicBrand, "primaryColor" | "accentColor" | "backgroundColor">]}
                      onChange={(input) =>
                        update(
                          key as keyof Pick<PublicBrand, "primaryColor" | "accentColor" | "backgroundColor">,
                          input.target.value.toUpperCase(),
                        )
                      }
                    />
                    <code>{brand[key as keyof Pick<PublicBrand, "primaryColor" | "accentColor" | "backgroundColor">]}</code>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="brand-form-section">
            <h3>Textos públicos</h3>
            <label>
              Botón de registro
              <input
                required
                minLength={3}
                maxLength={60}
                value={brand.registrationButtonLabel}
                onChange={(input) =>
                  update("registrationButtonLabel", input.target.value)
                }
              />
            </label>
            <label>
              Texto del pie
              <input
                required
                minLength={3}
                maxLength={160}
                value={brand.footerText}
                onChange={(input) => update("footerText", input.target.value)}
              />
            </label>
          </div>

          <div className="brand-form-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setBrand(DEFAULT_BRAND)}
            >
              Restaurar valores
            </button>
            <button className="primary-button" disabled={saving}>
              {saving ? "Guardando…" : "Guardar identidad"}
            </button>
          </div>
        </form>

        <aside className="brand-preview-column">
          <div className="brand-preview-heading">
            <div>
              <p className="eyebrow">VISTA PREVIA</p>
              <h2>Página de registro</h2>
            </div>
            <span>Actualización instantánea</span>
          </div>
          <section
            className="brand-preview"
            style={brandVariables(brand)}
            aria-label="Vista previa de la identidad pública"
          >
            <div className="brand-preview-hero">
              <PublicBrandIdentity brand={brand} />
              <div>
                <span>EVENTO EN VIVO</span>
                <h2>Liderazgo que transforma</h2>
                <p>Una experiencia diseñada para aprender, conectar e interactuar.</p>
                <small>28 DE JULIO · 10:00 A. M.</small>
              </div>
              <footer>Powered by {brand.organizationName} · {brand.footerText}</footer>
            </div>
            <div className="brand-preview-form">
              <p className="eyebrow">RESERVA TU LUGAR</p>
              <h3>Regístrate al evento</h3>
              <label>Nombre completo<span /></label>
              <label>Correo electrónico<span /></label>
              <button type="button">{brand.registrationButtonLabel} →</button>
            </div>
          </section>
          <div className="brand-preview-note">
            <span>✓</span>
            <p><b>Aplicación global</b><small>La misma identidad aparecerá en el registro y en el lobby de todos los eventos.</small></p>
          </div>
        </aside>
      </div>
    </>
  );
}
