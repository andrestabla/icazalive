"use client";

import Link from "next/link";
import { useState } from "react";
import type { HelpLocale } from "@/lib/help-content";

const text = {
  es: {
    open: "Abrir ayuda",
    close: "Cerrar ayuda",
    title: "¿Necesitas ayuda?",
    intro: "Consulta las guías o envíanos un incidente con el contexto necesario.",
    center: "Explorar Centro de ayuda",
    contact: "Contactar soporte",
    hours: "Horario de atención",
    language: "Idioma",
  },
  en: {
    open: "Open help",
    close: "Close help",
    title: "Need help?",
    intro: "Browse the guides or send an incident with the required context.",
    center: "Browse Help Center",
    contact: "Contact support",
    hours: "Support hours",
    language: "Language",
  },
  fr: {
    open: "Ouvrir l’aide",
    close: "Fermer l’aide",
    title: "Besoin d’aide ?",
    intro: "Consultez les guides ou envoyez un incident avec le contexte requis.",
    center: "Explorer le Centre d’aide",
    contact: "Contacter le support",
    hours: "Horaires du support",
    language: "Langue",
  },
};

export default function HelpWidget({
  supportEmail,
  supportHours,
}: {
  supportEmail: string;
  supportHours: string;
}) {
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<HelpLocale>("es");
  const labels = text[locale];

  return (
    <aside className="global-help-widget" aria-label={labels.title}>
      {open && (
        <section className="global-help-popover" role="dialog" aria-modal="false">
          <header>
            <span>?</span>
            <div>
              <b>{labels.title}</b>
              <small>Icaza Jammoul Live</small>
            </div>
            <button aria-label={labels.close} onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <p>{labels.intro}</p>
          <div className="global-help-actions">
            <Link href={`/help?lang=${locale}`} onClick={() => setOpen(false)}>
              <span>⌕</span>
              {labels.center}
              <i>→</i>
            </Link>
            <Link
              href={`/help?lang=${locale}&contact=1`}
              onClick={() => setOpen(false)}
            >
              <span>↗</span>
              {labels.contact}
              <i>→</i>
            </Link>
          </div>
          <div className="global-help-hours">
            <small>{labels.hours}</small>
            <b>{supportHours}</b>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </div>
          <footer>
            <span>{labels.language}</span>
            {(["es", "en", "fr"] as const).map((language) => (
              <button
                key={language}
                className={locale === language ? "active" : ""}
                aria-pressed={locale === language}
                onClick={() => setLocale(language)}
              >
                {language.toUpperCase()}
              </button>
            ))}
          </footer>
        </section>
      )}
      <button
        className="global-help-trigger"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "×" : "?"}
      </button>
    </aside>
  );
}
