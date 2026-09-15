"use client";

import { useEffect, useState } from "react";
import { fileUrl } from "@/lib/uploads";
import "../registration-tools.css";

// Imagen de fondo del panel izquierdo de la página de registro. Se sube a S3
// (brand/…, con URL prefirmada) o se indica una URL pública. Se guarda en
// events.registration_background.

function guessContentType(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[ext ?? ""] ?? "application/octet-stream";
}

async function uploadImage(file: File, onProgress: (percent: number) => void): Promise<string> {
  const contentType = guessContentType(file);
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope: "brand", filename: file.name, contentType, sizeBytes: file.size }),
  });
  const payload = (await presign.json()) as { data?: { uploadUrl: string; key: string }; error?: string };
  if (!presign.ok || !payload.data) throw new Error(payload.error ?? "No fue posible preparar la subida.");
  const { uploadUrl, key } = payload.data;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 rechazó la subida (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Fallo de red al subir la imagen."));
    xhr.send(file);
  });
  return key;
}

function previewUrl(value: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : fileUrl(value);
}

export default function RegistrationBackgroundPanel({ slug }: { slug: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${slug}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { registrationBackground?: string | null; event?: { registrationBackground?: string | null } } } | null) => {
        if (cancelled) return;
        const current = payload?.data?.event?.registrationBackground ?? payload?.data?.registrationBackground ?? null;
        setValue(current);
        if (current && /^https?:\/\//i.test(current)) setUrlInput(current);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const save = async (next: string | null) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/events/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registrationBackground: next }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice({ text: payload.error ?? "No fue posible guardar el fondo.", error: true });
      } else {
        setValue(next);
        if (!next) setUrlInput("");
        setNotice({ text: next ? "Fondo guardado. Ya se ve en la página de registro." : "Fondo retirado: se usa el degradado de la marca.", error: false });
      }
    } catch {
      setNotice({ text: "No fue posible contactar al servidor.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setNotice(null);
    try {
      const key = await uploadImage(file, setProgress);
      await save(key);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "No fue posible subir la imagen.", error: true });
      setBusy(false);
    }
  };

  const preview = previewUrl(value);

  return (
    <div className="registration-background">
      <header>
        <p className="eyebrow">FONDO DE LA PÁGINA DE REGISTRO</p>
        <h3>Imagen del panel izquierdo</h3>
        <p>Se muestra detrás del título y la fecha, con los colores del evento encima para que el texto siga legible. Recomendado: 1600×1200 px o mayor, JPG o PNG de hasta 3 MB.</p>
      </header>
      <div className="registration-background-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" />}
        <span>{preview ? "Vista previa del fondo" : "Sin imagen: degradado de la marca"}</span>
      </div>
      <div className="registration-background-actions">
        <label className="upload" aria-disabled={busy}>
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(input) => void onFile(input.target.files?.[0])} />
          {busy && progress > 0 && progress < 100 ? `Subiendo… ${progress}%` : "Subir imagen"}
        </label>
        <div className="url-row">
          <input
            type="url"
            value={urlInput}
            disabled={busy}
            onChange={(input) => setUrlInput(input.target.value)}
            placeholder="https://… o pega la URL de una imagen"
          />
          <button type="button" disabled={busy || !urlInput.trim()} onClick={() => void save(urlInput.trim())}>
            Usar URL
          </button>
        </div>
        {value && (
          <button type="button" className="danger" disabled={busy} onClick={() => void save(null)}>
            Quitar fondo
          </button>
        )}
      </div>
      {notice && (
        <p className={`registration-background-status ${notice.error ? "error" : "ok"}`} role="status">
          {notice.error ? "⚠ " : "✓ "}
          {notice.text}
        </p>
      )}
    </div>
  );
}
