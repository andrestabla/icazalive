"use client";

import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { useRef, useState } from "react";
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

// Tipo MIME cuando el navegador no lo informa (p. ej. .ico o .svg en algunos sistemas).
function guessContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return (
    { ico: "image/x-icon", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" }[ext ?? ""] ??
    "application/octet-stream"
  );
}

// Sube un archivo del módulo Marca directamente a S3 (brand/...) con una URL
// prefirmada; devuelve la clave del objeto y la URL con la que la app lo sirve.
async function uploadBrandFile(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ key: string; url: string }> {
  const contentType = guessContentType(file);
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope: "brand", filename: file.name, contentType, sizeBytes: file.size }),
  });
  const payload = (await presign.json()) as {
    data?: { uploadUrl: string; key: string; url: string };
    error?: string;
  };
  if (!presign.ok || !payload.data) {
    throw new Error(payload.error ?? "No fue posible preparar la subida.");
  }
  const { uploadUrl, key, url } = payload.data;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 rechazó la subida (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Fallo de red al subir a S3."));
    xhr.send(file);
  });
  return { key, url };
}

type AssetSlot = {
  keyField: "logoLightKey" | "logoDarkKey" | "faviconKey" | "loaderKey";
  urlField: "logoLightUrl" | "logoDarkUrl" | "faviconUrl" | "loaderUrl";
  title: string;
  hint: string;
  accept: string;
  surface: "light" | "dark";
};

const ASSET_SLOTS: AssetSlot[] = [
  { keyField: "logoLightKey", urlField: "logoLightUrl", title: "Logo · modo claro", hint: "Para fondos claros: panel, centro de ayuda. PNG o SVG con transparencia.", accept: "image/png,image/svg+xml,image/webp,image/jpeg", surface: "light" },
  { keyField: "logoDarkKey", urlField: "logoDarkUrl", title: "Logo · modo oscuro", hint: "Para fondos de color: registro, sala y correos. Versión en blanco o clara.", accept: "image/png,image/svg+xml,image/webp,image/jpeg", surface: "dark" },
  { keyField: "faviconKey", urlField: "faviconUrl", title: "Favicon", hint: "Icono de la pestaña. Cuadrado, 64×64 o más. SVG, PNG o ICO.", accept: "image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico", surface: "light" },
  { keyField: "loaderKey", urlField: "loaderUrl", title: "Loader", hint: "Animación mientras carga la plataforma. GIF, SVG animado, WebP o MP4 corto.", accept: "image/gif,image/svg+xml,image/webp,image/png,image/apng,video/mp4,video/webm", surface: "light" },
];

function BrandAssetField({
  slot,
  brand,
  onChange,
}: {
  slot: AssetSlot;
  brand: PublicBrand;
  onChange: (key: string | null, url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const url = brand[slot.urlField];
  const isVideo = Boolean(brand[slot.keyField]?.match(/\.(mp4|webm)$/i));

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setProgress(0);
    try {
      const uploaded = await uploadBrandFile(file, setProgress);
      onChange(uploaded.key, uploaded.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No fue posible subir el archivo.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="brand-asset">
      <div className={`brand-asset-preview ${slot.surface}`}>
        {url ? (
          isVideo ? (
            <video src={url} muted loop autoPlay playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" />
          )
        ) : (
          <span>Sin archivo</span>
        )}
        {progress !== null && <i style={{ width: `${progress}%` }} />}
      </div>
      <div className="brand-asset-body">
        <b>{slot.title}</b>
        <small>{slot.hint}</small>
        {error && <em>ⓘ {error}</em>}
        <div className="brand-asset-actions">
          <input ref={inputRef} type="file" accept={slot.accept} hidden onChange={pick} />
          <button type="button" className="secondary-action" disabled={progress !== null} onClick={() => inputRef.current?.click()}>
            {progress !== null ? `Subiendo ${progress}%` : url ? "Reemplazar" : "Subir archivo"}
          </button>
          {url && (
            <button type="button" className="brand-asset-remove" onClick={() => onChange(null, null)}>
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function brandVariables(brand: PublicBrand) {
  return {
    "--brand-primary": brand.primaryColor,
    "--brand-accent": brand.accentColor,
    "--brand-background": brand.backgroundColor,
  } as CSSProperties;
}

export default function BrandEditor({
  initialBrand,
  previewEventSlug,
}: {
  initialBrand: PublicBrand;
  previewEventSlug: string | null;
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
      setBrand(payload.data);
      setMessage("La identidad quedó guardada y ya se aplica en toda la plataforma.");
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
        {previewEventSlug && (
          <Link
            href={`/register/${previewEventSlug}`}
            target="_blank"
            className="secondary-action link-button"
          >
            Abrir página pública ↗
          </Link>
        )}
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
          </div>

          <div className="brand-form-section">
            <h3>Logotipos y recursos</h3>
            <p className="brand-section-hint">Los archivos se guardan en Amazon S3, en el directorio <code>brand/</code>, y la plataforma los sirve desde aquí.</p>
            <div className="brand-assets-grid">
              {ASSET_SLOTS.map((slot) => (
                <BrandAssetField
                  key={slot.keyField}
                  slot={slot}
                  brand={brand}
                  onChange={(key, url) =>
                    setBrand((current) => ({ ...current, [slot.keyField]: key, [slot.urlField]: url }))
                  }
                />
              ))}
            </div>
            <label>
              URL externa del logo <small>Opcional · solo si no subes archivos</small>
              <input
                type="url"
                maxLength={500}
                placeholder="https://empresa.com/logo.png"
                value={brand.logoUrl ?? ""}
                onChange={(input) => update("logoUrl", input.target.value || null)}
              />
            </label>
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
              <div className="brand-preview-tab">
                {brand.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.faviconUrl} alt="" width={14} height={14} />
                ) : (
                  <i />
                )}
                <span>{brand.organizationName} — Gestión de eventos</span>
              </div>
              <PublicBrandIdentity brand={brand} surface="light" />
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
