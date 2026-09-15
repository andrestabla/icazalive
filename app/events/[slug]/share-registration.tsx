"use client";

import { useEffect, useState } from "react";
import "../registration-tools.css";

// Compartir el enlace público de registro en redes y mensajería. Instagram no
// admite enlaces por URL: se copia el enlace para pegarlo en la biografía o en
// una historia.
export default function ShareRegistration({ slug, title }: { slug: string; title: string }) {
  const [url, setUrl] = useState(`/register/${slug}`);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/register/${slug}`);
  }, [slug]);

  const message = `Te invito a “${title}”. Regístrate aquí: ${url}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedMessage = encodeURIComponent(message);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copia el enlace:", url);
    }
  };

  return (
    <div className="share-registration" aria-label="Compartir enlace de registro">
      <small>Compartir</small>
      <a href={`https://wa.me/?text=${encodedMessage}`} target="_blank" rel="noreferrer">
        <i className="wa">W</i> WhatsApp
      </a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noreferrer">
        <i className="li">in</i> LinkedIn
      </a>
      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Te invito a “${title}”. Regístrate aquí:`)}&url=${encodedUrl}`} target="_blank" rel="noreferrer">
        <i className="x">X</i> X
      </a>
      <button type="button" onClick={() => void copy()} title="Instagram no admite enlaces directos: copia el enlace y pégalo en tu biografía o historia">
        <i className="ig">◎</i> Instagram
      </button>
      <button type="button" onClick={() => void copy()}>
        <i className="copy">⧉</i> Copiar enlace
      </button>
      {copied && <span className="share-note">✓ Enlace copiado. En Instagram pégalo en tu biografía o en una historia.</span>}
    </div>
  );
}
