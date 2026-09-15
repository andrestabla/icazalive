"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

// Guías paso a paso del organizador, con acceso directo desde el widget.
const guideLinks: { slug: string; icon: string; label: Record<HelpLocale, string> }[] = [
  { slug: "guide-manage-events", icon: "◫", label: { es: "Guía: gestionar eventos", en: "Guide: managing events", fr: "Guide : gérer les événements" } },
  { slug: "guide-participants", icon: "♙", label: { es: "Guía: participantes", en: "Guide: participants", fr: "Guide : participants" } },
  { slug: "guide-analytics", icon: "⌁", label: { es: "Guía: analítica", en: "Guide: analytics", fr: "Guide : analyses" } },
];

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
  // En las pantallas del participante (sala, registro, autogestión) el widget
  // solo ofrece soporte: las guías del Centro de ayuda son para el equipo.
  const pathname = usePathname() ?? "";
  const participantContext = /^\/(room|register|manage-registration|privacy)(\/|$)/.test(pathname);
  const participantIntro: Record<HelpLocale, string> = {
    es: "¿Tienes un problema con el evento? Escríbenos y te ayudamos.",
    en: "Having trouble with the event? Write to us and we will help.",
    fr: "Un problème avec l’événement ? Écrivez-nous et nous vous aiderons.",
  };

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
          <p>{participantContext ? participantIntro[locale] : labels.intro}</p>
          <div className="global-help-actions">
            {!participantContext && guideLinks.map((guide) => (
              <Link
                key={guide.slug}
                href={`/help?lang=${locale}&article=${guide.slug}`}
                onClick={() => setOpen(false)}
              >
                <span>{guide.icon}</span>
                {guide.label[locale]}
                <i>→</i>
              </Link>
            ))}
            {!participantContext && (
            <Link href={`/help?lang=${locale}`} onClick={() => setOpen(false)}>
              <span>⌕</span>
              {labels.center}
              <i>→</i>
            </Link>
            )}
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
