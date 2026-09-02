"use client";

import { useEffect, useState } from "react";

type Asset = {
  id: string;
  title: string;
  description: string | null;
  s3Key: string;
  sizeBytes: number | null;
  durationSeconds: number | null;
  createdAt: string;
};

type Unregistered = { s3Key: string; sizeBytes: number };

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

export default function ContentLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [unregistered, setUnregistered] = useState<Unregistered[]>([]);
  const [s3Configured, setS3Configured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  // Lee la duración del MP4 en el navegador antes de subirlo.
  const readDuration = (file: File): Promise<number | null> =>
    new Promise((resolve) => {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(el.src);
        resolve(Number.isFinite(el.duration) ? Math.round(el.duration) : null);
      };
      el.onerror = () => {
        URL.revokeObjectURL(el.src);
        resolve(null);
      };
      el.src = URL.createObjectURL(file);
    });

  // Sube el video directamente a S3 con una URL prefirmada y lo registra en la
  // biblioteca, sin que el gestor toque la consola de AWS.
  const uploadVideo = async (file: File) => {
    if (!file.type.startsWith("video/") && !file.name.toLowerCase().endsWith(".mp4")) {
      setStatus({ text: "Selecciona un archivo de video (MP4).", error: true });
      return;
    }
    setUploading(true);
    setUploadPct(0);
    setStatus({ text: `Preparando la subida de ${file.name}…`, error: false });
    try {
      const prep = await fetch("/api/content-assets/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type || "video/mp4" }),
      });
      const prepData = (await prep.json()) as {
        data?: { uploadUrl: string; key: string };
        error?: string;
      };
      if (!prep.ok || !prepData.data) {
        throw new Error(prepData.error ?? "No fue posible preparar la subida.");
      }
      const { uploadUrl, key } = prepData.data;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadPct(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`S3 respondió ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Fallo de red al subir a S3."));
        xhr.send(file);
      });

      setStatus({ text: "Registrando el contenido…", error: false });
      const duration = await readDuration(file);
      const title = file.name.replace(/\.[^.]+$/, "");
      const reg = await fetch("/api/content-assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, s3Key: key, durationSeconds: duration }),
      });
      if (!reg.ok) {
        const regData = (await reg.json()) as { error?: string };
        throw new Error(regData.error ?? "El video se subió pero no se pudo registrar.");
      }
      setStatus({ text: `“${title}” subido y disponible en la biblioteca.`, error: false });
      setRefreshKey((v) => v + 1);
    } catch (error) {
      setStatus({
        text: error instanceof Error ? error.message : "No fue posible subir el video.",
        error: true,
      });
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };


  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const response = await fetch("/api/content-assets", { cache: "no-store" });
      const payload = (await response.json()) as {
        data?: { assets: Asset[]; unregistered: Unregistered[]; s3Configured: boolean };
      };
      if (!cancelled && payload.data) {
        setAssets(payload.data.assets);
        setUnregistered(payload.data.unregistered);
        setS3Configured(payload.data.s3Configured);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const register = async (s3Key: string, suggestedTitle: string) => {
    const title = window.prompt("Título del contenido", suggestedTitle);
    if (!title) return;
    const response = await fetch("/api/content-assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, s3Key }),
    });
    const payload = (await response.json()) as { error?: string };
    setStatus(
      response.ok
        ? { text: `“${title}” añadido a la biblioteca.`, error: false }
        : { text: payload.error ?? "No fue posible registrar el contenido.", error: true },
    );
    setRefreshKey((value) => value + 1);
  };

  const [selected, setSelected] = useState<Asset | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const openAsset = async (asset: Asset) => {
    setSelected(asset);
    setNewTitle(asset.title);
    setPreviewUrl(null);
    const response = await fetch(`/api/content-assets/preview?id=${asset.id}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { data?: { url: string } } | null;
    if (payload?.data?.url) setPreviewUrl(payload.data.url);
  };

  const rename = async () => {
    if (!selected) return;
    const title = newTitle.trim();
    if (title.length < 2 || title === selected.title) return;
    setRenaming(true);
    const response = await fetch("/api/content-assets", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: selected.id, title }),
    });
    const payload = (await response.json()) as { data?: Asset; error?: string };
    if (response.ok && payload.data) {
      setSelected(payload.data);
      setStatus({ text: `Contenido renombrado a “${payload.data.title}” (también en S3).`, error: false });
      setRefreshKey((value) => value + 1);
    } else {
      setStatus({ text: payload.error ?? "No fue posible renombrar.", error: true });
    }
    setRenaming(false);
  };

  const remove = async (asset: Asset) => {
    if (!window.confirm(`¿Retirar “${asset.title}” de la biblioteca?`)) return;
    const response = await fetch(`/api/content-assets?id=${asset.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setStatus({ text: `“${asset.title}” retirado.`, error: false });
      setRefreshKey((value) => value + 1);
    }
  };

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="module-eyebrow">Configuración</p>
          <h1>Biblioteca de contenidos</h1>
          <p className="module-subtitle">
            Videos en Amazon S3 disponibles para los eventos simulados. El
            gestor los asigna a un evento sin volver a subirlos.
          </p>
        </div>
      </header>

      {status && (
        <p className={`module-status ${status.error ? "error" : "ok"}`} role="status">
          {status.text}
        </p>
      )}

      {!s3Configured && (
        <p className="module-status error">
          Amazon S3 no está configurado en el servidor. Define AWS_S3_BUCKET y
          las credenciales para usar la biblioteca.
        </p>
      )}

      <section className="content-section content-upload">
        <h2>Subir un contenido</h2>
        <p className="module-subtitle">
          Carga un video MP4 directamente desde tu equipo. Se guarda en Amazon
          S3 y queda disponible para asignarlo a eventos simulados.
        </p>
        <label className="content-upload-drop">
          <input
            type="file"
            accept="video/mp4,video/*"
            disabled={uploading || !s3Configured}
            onChange={(input) => {
              const file = input.target.files?.[0];
              if (file) void uploadVideo(file);
              input.target.value = "";
            }}
          />
          <span>{uploading ? `Subiendo… ${uploadPct}%` : "Elegir video MP4"}</span>
        </label>
        {uploading && (
          <div className="content-upload-bar">
            <div style={{ width: `${uploadPct}%` }} />
          </div>
        )}
      </section>

      <section className="content-section">
        <h2>Contenidos registrados</h2>
        {loading ? (
          <p className="content-empty">Cargando…</p>
        ) : assets.length === 0 ? (
          <p className="content-empty">
            Aún no hay contenidos. Sube videos al directorio <code>content/</code>{" "}
            del bucket y regístralos desde la lista de abajo.
          </p>
        ) : (
          <div className="content-grid">
            {assets.map((asset) => (
              <article key={asset.id} className="content-card">
                <div className="content-card-body content-card-clickable" role="button" tabIndex={0} onClick={() => void openAsset(asset)} onKeyDown={(e) => { if (e.key === "Enter") void openAsset(asset); }}>
                  <span className="content-card-icon">▷</span>
                  <div>
                    <b>{asset.title}</b>
                    <small>{formatSize(asset.sizeBytes)}</small>
                    <code>{asset.s3Key}</code>
                  </div>
                </div>
                <button className="content-remove" onClick={() => void remove(asset)}>
                  Retirar
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {unregistered.length > 0 && (
        <section className="content-section">
          <h2>En el bucket, sin registrar</h2>
          <p className="module-subtitle">
            Objetos bajo <code>content/</code> (o <code>library/</code>) que aún no están en la biblioteca.
          </p>
          <div className="content-grid">
            {unregistered.map((object) => {
              const name = object.s3Key.split("/").pop() ?? object.s3Key;
              return (
                <article key={object.s3Key} className="content-card unregistered">
                  <div className="content-card-body">
                    <span className="content-card-icon">⌁</span>
                    <div>
                      <b>{name}</b>
                      <small>{formatSize(object.sizeBytes)}</small>
                      <code>{object.s3Key}</code>
                    </div>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => void register(object.s3Key, name.replace(/\.[^.]+$/, ""))}
                  >
                    Añadir a la biblioteca
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {selected && (
        <div className="modal-backdrop" onMouseDown={() => !renaming && setSelected(null)}>
          <section className="modal content-preview-modal" role="dialog" aria-modal="true" aria-labelledby="content-preview-title" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar" disabled={renaming}>×</button>
            <p className="eyebrow">CONTENIDO</p>
            <h2 id="content-preview-title">{selected.title}</h2>
            <div className="content-preview-player">
              {previewUrl ? (
                <video src={previewUrl} controls playsInline preload="metadata" />
              ) : (
                <p>Preparando vista previa…</p>
              )}
            </div>
            <div className="content-preview-meta">
              <span>{formatSize(selected.sizeBytes)}</span>
              {selected.durationSeconds ? <span>{Math.round(selected.durationSeconds / 60)} min</span> : null}
              <code>{selected.s3Key}</code>
            </div>
            <label className="content-rename">
              Nombre del contenido
              <div>
                <input value={newTitle} maxLength={120} disabled={renaming} onChange={(e) => setNewTitle(e.target.value)} />
                <button className="primary-button" disabled={renaming || newTitle.trim().length < 2 || newTitle.trim() === selected.title} onClick={() => void rename()}>
                  {renaming ? "Guardando…" : "Guardar nombre"}
                </button>
              </div>
              <small>El cambio se aplica también al archivo en Amazon S3; los eventos que lo usan no se ven afectados.</small>
            </label>
            <div className="content-preview-actions">
              <button className="content-remove" disabled={renaming} onClick={() => { void remove(selected); setSelected(null); }}>Retirar de la biblioteca</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
