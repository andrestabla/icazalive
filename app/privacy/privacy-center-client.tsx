"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import PublicBrandIdentity from "@/app/components/public-brand";
import type { AuthenticatedUser } from "@/lib/auth";
import type { PublicBrand } from "@/lib/brand-config";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

type LegalDocument = {
  id: string;
  type: "privacy" | "terms";
  version: number;
  title: string;
  summary: string;
  content: string;
  publishedAt: string | null;
};

const requestTypes = {
  access: "Acceso a mis datos",
  correction: "Corrección de datos",
  deletion: "Eliminación de datos",
  portability: "Portabilidad",
  restriction: "Restricción del tratamiento",
};

function DocumentContent({ document }: { document: LegalDocument }) {
  const blocks = document.content.split("\n\n");
  return (
    <article
      id={document.type}
      className="privacy-document"
      aria-labelledby={`${document.type}-title`}
    >
      <header>
        <div>
          <p className="eyebrow">
            {document.type === "privacy" ? "PRIVACIDAD" : "CONDICIONES"}
          </p>
          <h2 id={`${document.type}-title`}>{document.title}</h2>
          <p>{document.summary}</p>
        </div>
        <span>Versión {document.version}</span>
      </header>
      <div>
        {blocks.map((block, index) =>
          index % 2 === 0 ? (
            <h3 key={`${index}-${block}`}>{block}</h3>
          ) : (
            <p key={`${index}-${block}`}>{block}</p>
          ),
        )}
      </div>
      <footer>
        Publicada{" "}
        {document.publishedAt
          ? new Intl.DateTimeFormat("es-CO", {
              dateStyle: "long",
              timeZone: PLATFORM_TIMEZONE,
            }).format(new Date(document.publishedAt))
          : "localmente"}
      </footer>
    </article>
  );
}

export default function PrivacyCenterClient({
  brand,
  viewer,
  documents,
  privacyEmail,
}: {
  brand: PublicBrand;
  viewer: AuthenticatedUser | null;
  documents: { privacy: LegalDocument; terms: LegalDocument };
  privacyEmail: string;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    id: string;
    dueAt: string;
  } | null>(null);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/data-rights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        type: form.get("type"),
        description: form.get("description"),
        consent: form.get("consent") === "on",
      }),
    });
    const payload = (await response.json()) as {
      data?: { id: string; dueAt: string };
      error?: string;
      duplicateId?: string;
    };
    if (response.ok && payload.data) {
      setCreated(payload.data);
    } else {
      setError(
        payload.duplicateId
          ? `${payload.error} #${payload.duplicateId.slice(0, 8)}`
          : payload.error ?? "No fue posible registrar la solicitud.",
      );
    }
    setSending(false);
  };

  return (
    <main
      className="privacy-center-shell"
      style={
        {
          "--brand-primary": brand.primaryColor,
          "--brand-accent": brand.accentColor,
          "--brand-background": brand.backgroundColor,
        } as CSSProperties
      }
    >
      <header className="privacy-public-header">
        <Link href="/" aria-label="Ir al inicio">
          <PublicBrandIdentity brand={brand} />
        </Link>
        <nav aria-label="Navegación de privacidad">
          <a href="#privacy">Privacidad</a>
          <a href="#terms">Términos</a>
          <a href="#request">Ejercer derechos</a>
          {viewer && <Link href="/">Panel</Link>}
        </nav>
      </header>

      <section className="privacy-hero">
        <div>
          <p className="eyebrow">CENTRO DE PRIVACIDAD</p>
          <h1>Tus datos, con reglas claras.</h1>
          <p>
            Consulta las versiones vigentes, entiende qué guardamos y solicita
            acceso, corrección o eliminación desde un único lugar.
          </p>
          <a href="#request">Ejercer un derecho →</a>
        </div>
        <aside aria-label="Principios de privacidad">
          <div>
            <span>◇</span>
            <p><b>Datos mínimos</b><small>Solo lo necesario para operar eventos.</small></p>
          </div>
          <div>
            <span>≋</span>
            <p><b>Consentimiento trazable</b><small>Versión, fecha y contexto verificables.</small></p>
          </div>
          <div>
            <span>✓</span>
            <p><b>Respuesta en 30 días</b><small>Con verificación previa de identidad.</small></p>
          </div>
        </aside>
      </section>

      <section className="privacy-documents">
        <DocumentContent document={documents.privacy} />
        <DocumentContent document={documents.terms} />
      </section>

      <section id="request" className="privacy-request-section">
        <div className="privacy-request-intro">
          <p className="eyebrow">DERECHOS SOBRE TUS DATOS</p>
          <h2>Registra una solicitud</h2>
          <p>
            Te responderemos en un máximo de 30 días. Primero verificaremos tu
            identidad para evitar entregas o eliminaciones no autorizadas.
          </p>
          <div>
            <b>Antes de enviar</b>
            <span>Usa el mismo correo del registro.</span>
            <span>No adjuntes contraseñas, tokens ni documentos completos.</span>
            <span>Evita crear solicitudes duplicadas.</span>
          </div>
          <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>
        </div>

        {created ? (
          <div className="privacy-request-success" role="status">
            <span>✓</span>
            <p className="eyebrow">SOLICITUD REGISTRADA</p>
            <h2>#{created.id.slice(0, 8)}</h2>
            <p>
              Conserva el número. Fecha límite estimada:{" "}
              <b>
                {new Intl.DateTimeFormat("es-CO", {
                  dateStyle: "long",
                  timeZone: PLATFORM_TIMEZONE,
                }).format(new Date(created.dueAt))}
              </b>.
            </p>
            <button onClick={() => setCreated(null)}>
              Registrar otra solicitud
            </button>
          </div>
        ) : (
          <form className="privacy-request-form" onSubmit={submitRequest}>
            <div>
              <label>
                Nombre completo
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={viewer?.name ?? ""}
                  autoComplete="name"
                />
              </label>
              <label>
                Correo relacionado
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  defaultValue={viewer?.email ?? ""}
                  autoComplete="email"
                />
              </label>
            </div>
            <label>
              Derecho que deseas ejercer
              <select name="type" required defaultValue="access">
                {Object.entries(requestTypes).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Contexto <small>Opcional</small>
              <textarea
                name="description"
                rows={4}
                maxLength={2_000}
                placeholder="Evento o datos a los que se refiere la solicitud"
              />
            </label>
            <label className="privacy-request-consent">
              <input name="consent" type="checkbox" required />
              <span>
                Acepto que estos datos se usen únicamente para validar y
                responder mi solicitud.
              </span>
            </label>
            {error && <div className="wizard-error" role="alert">ⓘ {error}</div>}
            <button disabled={sending}>
              {sending ? "Registrando…" : "Registrar solicitud"}
            </button>
          </form>
        )}
      </section>

      <footer className="privacy-public-footer">
        <PublicBrandIdentity brand={brand} />
        <p>
          Versiones vigentes y solicitudes almacenadas en la base local ·{" "}
          <Link href="/help">Centro de ayuda</Link>
        </p>
      </footer>
    </main>
  );
}
