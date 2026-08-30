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

      <section className="content-section">
        <h2>Contenidos registrados</h2>
        {loading ? (
          <p className="content-empty">Cargando…</p>
        ) : assets.length === 0 ? (
          <p className="content-empty">
            Aún no hay contenidos. Sube videos al prefijo <code>library/</code>{" "}
            del bucket y regístralos desde la lista de abajo.
          </p>
        ) : (
          <div className="content-grid">
            {assets.map((asset) => (
              <article key={asset.id} className="content-card">
                <div className="content-card-body">
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
            Objetos bajo <code>library/</code> que aún no están en la biblioteca.
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
    </div>
  );
}
