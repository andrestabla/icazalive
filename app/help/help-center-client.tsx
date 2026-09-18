"use client";

import "./help-guide.css";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { AuthenticatedUser } from "@/lib/auth";
import type { PublicBrand } from "@/lib/brand-config";
import {
  articleBySlug,
  categoryById,
  helpArticles,
  helpCategories,
  type HelpArticle,
  type HelpGuideSection,
  type HelpLocale,
} from "@/lib/help-content";

const guideText = {
  es: { contents: "Contenido de la guía", steps: "pasos", open: "Ver captura a tamaño completo", related: "Guías relacionadas", tip: "Consejo", warning: "Atención" },
  en: { contents: "In this guide", steps: "steps", open: "Open screenshot at full size", related: "Related guides", tip: "Tip", warning: "Heads up" },
  fr: { contents: "Dans ce guide", steps: "étapes", open: "Ouvrir la capture en taille réelle", related: "Guides associés", tip: "Conseil", warning: "Attention" },
} as const;

// Marcado mínimo en los pasos: **negrita**, `código` y [[tecla]].
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <b key={index}>{part.slice(2, -2)}</b>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("[[") && part.endsWith("]]")) return <kbd key={index}>{part.slice(2, -2)}</kbd>;
    return <span key={index}>{part}</span>;
  });
}

function GuideBody({
  sections,
  locale,
}: {
  sections: HelpGuideSection[];
  locale: HelpLocale;
}) {
  const labels = guideText[locale];
  let counter = 0;
  return (
    <>
      <nav className="help-guide-toc" aria-label={labels.contents}>
        <b>{labels.contents}</b>
        <ol>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#guide-${section.id}`}>{section.title[locale]}</a>
              <small>{section.steps.length} {labels.steps}</small>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((section) => (
        <section className="help-guide-section" id={`guide-${section.id}`} key={section.id}>
          <h2>{section.title[locale]}</h2>
          {section.intro && <p>{section.intro[locale]}</p>}
          <ol className="help-guide-steps">
            {section.steps.map((step, index) => {
              counter += 1;
              return (
                <li className="help-guide-step" key={`${section.id}-${index}`}>
                  <i>{counter}</i>
                  <div>
                    <p>{renderInline(step.text[locale])}</p>
                    {step.image && (
                      <figure className="help-guide-figure">
                        <a href={step.image} target="_blank" rel="noreferrer" title={labels.open}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={step.image} alt={step.caption?.[locale] ?? ""} loading="lazy" />
                        </a>
                        {step.caption && <figcaption>{step.caption[locale]}</figcaption>}
                      </figure>
                    )}
                    {step.tip && (
                      <div className="help-guide-note tip"><span>✓</span><div><b>{labels.tip}.</b> {renderInline(step.tip[locale])}</div></div>
                    )}
                    {step.warning && (
                      <div className="help-guide-note warning"><span>!</span><div><b>{labels.warning}.</b> {renderInline(step.warning[locale])}</div></div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}

const uiText = {
  es: {
    helpCenter: "Centro de ayuda",
    hero: "¿Cómo podemos ayudarte?",
    intro:
      "Encuentra respuestas, prepara tus eventos y contacta a soporte cuando lo necesites.",
    search: "Buscar artículos, funciones o errores…",
    all: "Todos",
    categories: "Explora por categoría",
    articles: "Artículos",
    featured: "Guías recomendadas",
    results: "resultados",
    noResults: "No encontramos artículos para esta búsqueda.",
    clear: "Limpiar búsqueda",
    read: "Leer guía",
    back: "Volver a los artículos",
    contact: "Contactar soporte",
    contactTitle: "Cuéntanos qué ocurrió",
    contactIntro:
      "Incluye el contexto necesario. No envíes contraseñas, tokens ni claves.",
    send: "Enviar solicitud",
    sending: "Enviando…",
    success: "Solicitud recibida",
    evidence: "Adjuntar evidencias (capturas, PDF, video)",
    evidenceSending: "Subiendo evidencias…",
    evidenceDone: "{n} archivo(s) adjuntado(s) al caso.",
    ticketLink: "Ver el seguimiento de mi caso ↗",
    privacy:
      "Usaremos estos datos solo para atender la solicitud y los conservaremos durante 180 días.",
    consent:
      "Acepto el tratamiento mínimo de estos datos para recibir soporte.",
    panel: "Panel",
    sales: "Ventas",
    language: "Idioma del centro de ayuda",
    documentation: "DOCUMENTACIÓN",
    featuredEyebrow: "DESTACADOS",
    supportEyebrow: "SOPORTE ICAZA LIVE",
    articleSingular: "artículo",
    articlePlural: "artículos",
    categoryPlural: "categorías",
    unresolved: "¿La guía no resolvió el problema?",
    footer: "Documentación disponible en todo momento",
    name: "Nombre",
    email: "Correo",
    category: "Categoría",
    subject: "Asunto",
    description: "Descripción",
    subjectPlaceholder: "Resumen breve del incidente",
    descriptionPlaceholder:
      "Qué esperabas, qué ocurrió y pasos para reproducirlo",
    context: "Contexto del evento y evidencia",
    eventTitle: "Título del evento",
    eventUrl: "https://… enlace afectado",
    affectedEmail: "Correo de la persona afectada",
    screenshotUrl: "https://… captura sin datos sensibles",
    successBody:
      "Conserva este número para dar seguimiento. Evita enviar otra solicitud para el mismo incidente.",
    close: "Cerrar",
    closeSupport: "Cerrar soporte",
  },
  en: {
    helpCenter: "Help Center",
    hero: "How can we help?",
    intro:
      "Find answers, prepare your events, and contact support when needed.",
    search: "Search articles, features, or errors…",
    all: "All",
    categories: "Browse by category",
    articles: "Articles",
    featured: "Recommended guides",
    results: "results",
    noResults: "We could not find articles for this search.",
    clear: "Clear search",
    read: "Read guide",
    back: "Back to articles",
    contact: "Contact support",
    contactTitle: "Tell us what happened",
    contactIntro:
      "Include the required context. Do not send passwords, tokens, or keys.",
    send: "Send request",
    sending: "Sending…",
    success: "Request received",
    evidence: "Attach evidence (screenshots, PDF, video)",
    evidenceSending: "Uploading evidence…",
    evidenceDone: "{n} file(s) attached to the case.",
    ticketLink: "Track my case ↗",
    privacy:
      "We will use this data only to handle the request and retain it for 180 days.",
    consent:
      "I accept the minimum processing of this data to receive support.",
    panel: "Dashboard",
    sales: "Sales",
    language: "Help Center language",
    documentation: "DOCUMENTATION",
    featuredEyebrow: "FEATURED",
    supportEyebrow: "ICAZA LIVE SUPPORT",
    articleSingular: "article",
    articlePlural: "articles",
    categoryPlural: "categories",
    unresolved: "Did the guide not solve the issue?",
    footer: "Local documentation available at all times",
    name: "Name",
    email: "Email",
    category: "Category",
    subject: "Subject",
    description: "Description",
    subjectPlaceholder: "Brief summary of the incident",
    descriptionPlaceholder:
      "What you expected, what happened, and steps to reproduce it",
    context: "Event context and evidence",
    eventTitle: "Event title",
    eventUrl: "https://… affected link",
    affectedEmail: "Email of the affected person",
    screenshotUrl: "https://… screenshot without sensitive data",
    successBody:
      "Keep this number for follow-up. Avoid sending another request for the same incident.",
    close: "Close",
    closeSupport: "Close support",
  },
  fr: {
    helpCenter: "Centre d’aide",
    hero: "Comment pouvons-nous vous aider ?",
    intro:
      "Trouvez des réponses, préparez vos événements et contactez le support si nécessaire.",
    search: "Rechercher des articles, fonctions ou erreurs…",
    all: "Tous",
    categories: "Explorer par catégorie",
    articles: "Articles",
    featured: "Guides recommandés",
    results: "résultats",
    noResults: "Aucun article ne correspond à cette recherche.",
    clear: "Effacer la recherche",
    read: "Lire le guide",
    back: "Retour aux articles",
    contact: "Contacter le support",
    contactTitle: "Expliquez-nous ce qui s’est passé",
    contactIntro:
      "Incluez le contexte nécessaire. N’envoyez jamais de mots de passe, jetons ou clés.",
    send: "Envoyer la demande",
    sending: "Envoi…",
    success: "Demande reçue",
    evidence: "Joindre des preuves (captures, PDF, vidéo)",
    evidenceSending: "Envoi des preuves…",
    evidenceDone: "{n} fichier(s) joint(s) au dossier.",
    ticketLink: "Suivre mon dossier ↗",
    privacy:
      "Nous utiliserons ces données uniquement pour traiter la demande et les conserverons pendant 180 jours.",
    consent:
      "J’accepte le traitement minimal de ces données pour recevoir de l’aide.",
    panel: "Tableau de bord",
    sales: "Ventes",
    language: "Langue du Centre d’aide",
    documentation: "DOCUMENTATION",
    featuredEyebrow: "À LA UNE",
    supportEyebrow: "SUPPORT ICAZA LIVE",
    articleSingular: "article",
    articlePlural: "articles",
    categoryPlural: "catégories",
    unresolved: "Le guide n’a pas résolu le problème ?",
    footer: "Documentation locale disponible à tout moment",
    name: "Nom",
    email: "E-mail",
    category: "Catégorie",
    subject: "Objet",
    description: "Description",
    subjectPlaceholder: "Résumé bref de l’incident",
    descriptionPlaceholder:
      "Ce que vous attendiez, ce qui s’est passé et comment le reproduire",
    context: "Contexte de l’événement et preuves",
    eventTitle: "Titre de l’événement",
    eventUrl: "https://… lien affecté",
    affectedEmail: "E-mail de la personne affectée",
    screenshotUrl: "https://… capture sans données sensibles",
    successBody:
      "Conservez ce numéro pour le suivi. Évitez une autre demande pour le même incident.",
    close: "Fermer",
    closeSupport: "Fermer le support",
  },
};

const contactCategories = {
  technical: { es: "Problema técnico", en: "Technical issue", fr: "Problème technique" },
  event: { es: "Evento", en: "Event", fr: "Événement" },
  account: { es: "Cuenta y acceso", en: "Account and access", fr: "Compte et accès" },
  integration: { es: "Integración", en: "Integration", fr: "Intégration" },
  billing: { es: "Facturación", en: "Billing", fr: "Facturation" },
  privacy: { es: "Privacidad", en: "Privacy", fr: "Confidentialité" },
  other: { es: "Otro", en: "Other", fr: "Autre" },
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function articleMatches(article: HelpArticle, locale: HelpLocale, query: string) {
  if (!query) return true;
  const haystack = normalize(
    [
      article.title[locale],
      article.summary[locale],
      article.content[locale],
      ...article.keywords[locale],
      ...(article.sections ?? []).flatMap((section) => [
        section.title[locale],
        ...section.steps.map((step) => step.text[locale]),
      ]),
    ].join(" "),
  );
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function Brand({
  brand,
}: {
  brand: PublicBrand;
}) {
  return (
    <div className="help-brand">
      {(brand.logoLightUrl ?? brand.logoUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoLightUrl ?? brand.logoUrl ?? ""} alt="" width={34} height={34} />
      ) : (
        <span
          style={{
            background: `linear-gradient(145deg, ${brand.accentColor}, ${brand.primaryColor})`,
          }}
        >
          {brand.markText}
        </span>
      )}
      <b>{brand.organizationName}</b>
    </div>
  );
}

export default function HelpCenterClient({
  brand,
  viewer,
  initialLocale,
  initialArticle,
  initialContactOpen,
  supportEmail,
  salesEmail,
  supportHours,
}: {
  brand: PublicBrand;
  viewer: AuthenticatedUser | null;
  initialLocale: HelpLocale;
  initialArticle: string | null;
  initialContactOpen: boolean;
  supportEmail: string;
  salesEmail: string;
  supportHours: string;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(
    initialArticle ? articleBySlug(initialArticle) ?? null : null,
  );
  const [contactOpen, setContactOpen] = useState(initialContactOpen);
  // Las guías son para el equipo. Un participante (o un visitante sin sesión)
  // solo ve el canal de soporte.
  const restricted = !viewer || viewer.role === "participant";
  const [sending, setSending] = useState(false);
  const [contactError, setContactError] = useState("");
  const [createdRequest, setCreatedRequest] = useState<{
    id: string;
    supportEmail: string;
    serviceHours: string;
    token?: string;
    ticketPath?: string;
  } | null>(null);
  const [evidenceState, setEvidenceState] = useState<{ busy: boolean; done: number; error: string }>({ busy: false, done: 0, error: "" });
  const uploadEvidence = async (files: FileList | null) => {
    if (!createdRequest?.token || !files || files.length === 0) return;
    setEvidenceState({ busy: true, done: evidenceState.done, error: "" });
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    const response = await fetch(`/api/support/ticket/${encodeURIComponent(createdRequest.token)}/attachments`, { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as { data?: unknown[]; error?: string };
    setEvidenceState({ busy: false, done: evidenceState.done + (response.ok ? (payload.data?.length ?? files.length) : 0), error: response.ok ? "" : payload.error ?? "No fue posible adjuntar." });
  };
  const labels = uiText[locale];

  const filteredArticles = useMemo(
    () =>
      helpArticles.filter(
        (article) =>
          (!category || article.category === category) &&
          articleMatches(article, locale, query),
      ),
    [category, locale, query],
  );

  const openArticle = (article: HelpArticle) => {
    setSelectedArticle(article);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitSupport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setContactError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/support-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        language: locale,
        category: form.get("category"),
        subject: form.get("subject"),
        description: form.get("description"),
        eventTitle: form.get("eventTitle"),
        eventDate: form.get("eventDate"),
        eventUrl: form.get("eventUrl"),
        affectedEmail: form.get("affectedEmail"),
        screenshotUrl: form.get("screenshotUrl"),
        consent: form.get("consent") === "on",
      }),
    });
    const payload = (await response.json()) as {
      data?: {
        id: string;
        supportEmail: string;
        serviceHours: string;
        token?: string;
        ticketPath?: string;
      };
      error?: string;
      duplicateId?: string;
    };
    if (response.ok && payload.data) {
      setCreatedRequest(payload.data);
    } else {
      setContactError(
        payload.duplicateId
          ? `${payload.error} #${payload.duplicateId.slice(0, 8)}`
          : payload.error ?? "No fue posible enviar la solicitud.",
      );
    }
    setSending(false);
  };

  return (
    <main className="help-center-shell">
      <header className="help-topbar">
        <Link href="/help" className="help-brand-link">
          <Brand brand={brand} />
          <span>{labels.helpCenter}</span>
        </Link>
        <nav>
          {viewer && <Link href="/">← {labels.panel}</Link>}
          {!restricted && <a href={`mailto:${salesEmail}`}>{labels.sales}</a>}
          <button onClick={() => setContactOpen(true)}>
            {labels.contact}
          </button>
          <label>
            <span className="sr-only">{labels.language}</span>
            <select
              aria-label={labels.language}
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value as HelpLocale)
              }
            >
              <option value="es">ES</option>
              <option value="en">EN</option>
              <option value="fr">FR</option>
            </select>
          </label>
        </nav>
      </header>

      {restricted ? (
        <section
          className="help-hero help-hero-support"
          style={{
            background: `radial-gradient(circle at 75% 20%, ${brand.accentColor}55, transparent 36%), linear-gradient(135deg, ${brand.primaryColor}, color-mix(in srgb, ${brand.primaryColor} 72%, #6946e8))`,
          }}
        >
          <p className="eyebrow">{labels.supportEyebrow}</p>
          <h1>{labels.contactTitle}</h1>
          <p>{labels.contactIntro}</p>
          <div className="help-support-actions">
            <button onClick={() => setContactOpen(true)}>{labels.contact}</button>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </div>
          <small>{supportHours}</small>
        </section>
      ) : selectedArticle ? (
        <article className="help-article-view">
          <button
            className="help-back"
            onClick={() => setSelectedArticle(null)}
          >
            ← {labels.back}
          </button>
          <div className="help-article-layout">
            <aside>
              <span>{categoryById(selectedArticle.category)?.icon}</span>
              <b>
                {categoryById(selectedArticle.category)?.label[locale]}
              </b>
              {selectedArticle.subcategory && (
                <small>
                  {categoryById(selectedArticle.category)?.subcategories?.find(
                    (subcategory) =>
                      subcategory.id === selectedArticle.subcategory,
                  )?.label[locale]}
                </small>
              )}
            </aside>
            <div>
              <p className="eyebrow">
                {categoryById(selectedArticle.category)?.label[locale]}
              </p>
              <h1>{selectedArticle.title[locale]}</h1>
              <p className="help-article-summary">
                {selectedArticle.summary[locale]}
              </p>
              <div className="help-article-content">
                {selectedArticle.content[locale]
                  .split("\n\n")
                  .filter(Boolean)
                  .map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                {selectedArticle.sections && (
                  <GuideBody sections={selectedArticle.sections} locale={locale} />
                )}
                {selectedArticle.related && selectedArticle.related.length > 0 && (
                  <div className="help-guide-related">
                    <b>{guideText[locale].related}</b>
                    {selectedArticle.related.map((slug) => {
                      const target = articleBySlug(slug);
                      if (!target) return null;
                      return (
                        <button key={slug} onClick={() => { setSelectedArticle(target); window.scrollTo({ top: 0 }); }}>
                          {target.title[locale]} →
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <section className="help-article-support">
                <div>
                  <b>{labels.unresolved}</b>
                  <span>{supportHours}</span>
                </div>
                <button onClick={() => setContactOpen(true)}>
                  {labels.contact}
                </button>
              </section>
            </div>
          </div>
        </article>
      ) : (
        <>
          <section
            className="help-hero"
            style={{
              background: `radial-gradient(circle at 75% 20%, ${brand.accentColor}55, transparent 36%), linear-gradient(135deg, ${brand.primaryColor}, color-mix(in srgb, ${brand.primaryColor} 72%, #6946e8))`,
            }}
          >
            <p className="eyebrow">{labels.helpCenter}</p>
            <h1>{labels.hero}</h1>
            <p>{labels.intro}</p>
            <label className="help-search">
              <span>⌕</span>
              <input
                aria-label={labels.search}
                placeholder={labels.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  aria-label={labels.clear}
                  onClick={() => setQuery("")}
                >
                  ×
                </button>
              )}
            </label>
            <small>
              {helpArticles.length} {labels.articlePlural} · Español · English · Français
            </small>
          </section>

          <div className="help-content-width">
            {!query && !category && (
              <section className="help-category-section">
                <div className="help-section-heading">
                  <div>
                    <p className="eyebrow">{labels.documentation}</p>
                    <h2>{labels.categories}</h2>
                  </div>
                  <span>{helpCategories.length} {labels.categoryPlural}</span>
                </div>
                <div className="help-category-grid">
                  {helpCategories.map((item) => {
                    const articleCount = helpArticles.filter(
                      (article) => article.category === item.id,
                    ).length;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setCategory(item.id)}
                      >
                        <span>{item.icon}</span>
                        <div>
                          <h3>{item.label[locale]}</h3>
                          <p>{item.description[locale]}</p>
                          <small>
                            {articleCount}{" "}
                            {articleCount === 1
                              ? labels.articleSingular
                              : labels.articlePlural} →
                          </small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {!query && !category && (
              <section className="help-featured-section">
                <div className="help-section-heading">
                  <div>
                    <p className="eyebrow">{labels.featuredEyebrow}</p>
                    <h2>{labels.featured}</h2>
                  </div>
                </div>
                <div className="help-featured-grid">
                  {helpArticles
                    .filter((article) => article.featured)
                    .map((article) => (
                      <button
                        key={article.slug}
                        onClick={() => openArticle(article)}
                      >
                        <span>{categoryById(article.category)?.icon}</span>
                        <p>
                          <small>
                            {categoryById(article.category)?.label[locale]}
                          </small>
                          <b>{article.title[locale]}</b>
                        </p>
                        <i>→</i>
                      </button>
                    ))}
                </div>
              </section>
            )}

            {(query || category) && (
              <section className="help-results-section">
                <div className="help-results-heading">
                  <div>
                    <p className="eyebrow">{labels.articles}</p>
                    <h2>
                      {category
                        ? categoryById(category)?.label[locale]
                        : `"${query}"`}
                    </h2>
                    <p>
                      {filteredArticles.length} {labels.results}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCategory("");
                      setQuery("");
                    }}
                  >
                    × {labels.clear}
                  </button>
                </div>
                {category &&
                  categoryById(category)?.subcategories?.length && (
                    <div className="help-subcategories">
                      {categoryById(category)?.subcategories?.map(
                        (subcategory) => (
                          <span key={subcategory.id}>
                            {subcategory.label[locale]}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                <div className="help-result-list">
                  {filteredArticles.map((article) => (
                    <button
                      key={article.slug}
                      onClick={() => openArticle(article)}
                    >
                      <span>{categoryById(article.category)?.icon}</span>
                      <div>
                        <small>
                          {categoryById(article.category)?.label[locale]}
                        </small>
                        <h3>{article.title[locale]}</h3>
                        <p>{article.summary[locale]}</p>
                      </div>
                      <i>{labels.read} →</i>
                    </button>
                  ))}
                  {!filteredArticles.length && (
                    <div className="help-empty">
                      <span>⌕</span>
                      <h3>{labels.noResults}</h3>
                      <button
                        onClick={() => {
                          setCategory("");
                          setQuery("");
                        }}
                      >
                        {labels.clear}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="help-contact-banner">
              <div>
                <p className="eyebrow">{labels.supportEyebrow}</p>
                <h2>{labels.contactTitle}</h2>
                <p>
                  {supportHours} · ES / EN / FR ·{" "}
                  <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
                </p>
              </div>
              <button onClick={() => setContactOpen(true)}>
                {labels.contact} →
              </button>
            </section>
          </div>
        </>
      )}

      <footer className="help-footer">
        <Brand brand={brand} />
        <p>
          {labels.footer} ·{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
      </footer>

      {contactOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !sending) {
              setContactOpen(false);
            }
          }}
        >
          <section
            className="modal help-contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-title"
          >
            <button
              className="modal-close"
              aria-label={labels.closeSupport}
              disabled={sending}
              onClick={() => setContactOpen(false)}
            >
              ×
            </button>
            {createdRequest ? (
              <div className="support-success">
                <span>✓</span>
                <p className="eyebrow">{labels.success}</p>
                <h2 id="support-title">#{createdRequest.id.slice(0, 8)}</h2>
                <p>
                  {labels.successBody}
                </p>
                <div>
                  <b>{createdRequest.supportEmail}</b>
                  <small>{createdRequest.serviceHours}</small>
                </div>
                {createdRequest.token && (
                  <div className="support-success-actions">
                    <label className="support-evidence">
                      <input type="file" multiple hidden disabled={evidenceState.busy} accept="image/*,application/pdf,video/*,text/plain,text/csv,.docx,.xlsx,.pptx,.zip" onChange={(input) => { void uploadEvidence(input.target.files); input.target.value = ""; }} />
                      <span className="secondary-action">{evidenceState.busy ? labels.evidenceSending : labels.evidence}</span>
                      {evidenceState.done > 0 && <small>{labels.evidenceDone.replace("{n}", String(evidenceState.done))}</small>}
                      {evidenceState.error && <small className="support-evidence-error">{evidenceState.error}</small>}
                    </label>
                    <a className="support-ticket-link" href={createdRequest.ticketPath} target="_blank" rel="noreferrer">{labels.ticketLink}</a>
                  </div>
                )}
                <button
                  className="primary-button"
                  onClick={() => {
                    setCreatedRequest(null);
                    setEvidenceState({ busy: false, done: 0, error: "" });
                    setContactOpen(false);
                  }}
                >
                  {labels.close}
                </button>
              </div>
            ) : (
              <>
                <p className="eyebrow">{labels.contact}</p>
                <h2 id="support-title">{labels.contactTitle}</h2>
                <p>{labels.contactIntro}</p>
                <form className="support-form" onSubmit={submitSupport}>
                  <div className="support-form-row">
                    <label>
                      {labels.name}
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
                      {labels.email}
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
                  <div className="support-form-row">
                    <label>
                      {labels.category}
                      <select name="category" required defaultValue="technical">
                        {Object.entries(contactCategories).map(
                          ([value, translation]) => (
                            <option key={value} value={value}>
                              {translation[locale]}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      {labels.subject}
                      <input
                        name="subject"
                        required
                        minLength={5}
                        maxLength={180}
                        placeholder={labels.subjectPlaceholder}
                      />
                    </label>
                  </div>
                  <label>
                    {labels.description}
                    <textarea
                      name="description"
                      required
                      minLength={20}
                      maxLength={5000}
                      rows={4}
                      placeholder={labels.descriptionPlaceholder}
                    />
                  </label>
                  <details>
                    <summary>{labels.context}</summary>
                    <div className="support-optional-fields">
                      <input
                        name="eventTitle"
                        maxLength={180}
                        placeholder={labels.eventTitle}
                      />
                      <input name="eventDate" type="datetime-local" />
                      <input
                        name="eventUrl"
                        type="url"
                        maxLength={500}
                        placeholder={labels.eventUrl}
                      />
                      <input
                        name="affectedEmail"
                        type="email"
                        maxLength={254}
                        placeholder={labels.affectedEmail}
                      />
                      <input
                        name="screenshotUrl"
                        type="url"
                        maxLength={500}
                        placeholder={labels.screenshotUrl}
                      />
                    </div>
                  </details>
                  <label className="support-consent">
                    <input name="consent" type="checkbox" required />
                    <span>
                      <b>{labels.consent}</b>
                      <small>{labels.privacy}</small>
                    </span>
                  </label>
                  {contactError && (
                    <div className="wizard-error" role="alert">
                      ⓘ {contactError}
                    </div>
                  )}
                  <button className="primary-button" disabled={sending}>
                    {sending ? labels.sending : labels.send}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
