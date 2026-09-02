// Subidas de archivos de la plataforma a S3. Cada módulo guarda bajo su
// propio directorio del bucket: brand/, participants/, content/.
// Este módulo no depende de Node y puede importarse desde el cliente.

export type UploadScope = "brand" | "participants" | "content";

export const UPLOAD_SCOPES: Record<
  UploadScope,
  { prefix: string; maxBytes: number; accept: RegExp; label: string }
> = {
  brand: {
    prefix: "brand/",
    maxBytes: 3 * 1024 * 1024,
    accept: /^(image\/(png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon|apng)|video\/(mp4|webm))$/,
    label: "Marca",
  },
  participants: {
    prefix: "participants/",
    maxBytes: 10 * 1024 * 1024,
    accept: /^(image\/(png|jpeg|webp|gif)|application\/pdf|text\/csv|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/,
    label: "Participantes",
  },
  content: {
    prefix: "content/",
    maxBytes: 8 * 1024 * 1024 * 1024,
    accept: /^video\//,
    label: "Contenidos",
  },
};

export function isUploadScope(value: unknown): value is UploadScope {
  return value === "brand" || value === "participants" || value === "content";
}

// Clave única y legible: <prefijo>/<marca de tiempo>-<nombre saneado>.
export function buildUploadKey(scope: UploadScope, filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120);
  const stamp = Date.now().toString(36);
  return `${UPLOAD_SCOPES[scope].prefix}${stamp}-${safe}`;
}

// Los recursos de marca son públicos (logos, favicon) y se sirven a través
// de la app; el resto de directorios no se expone por esta vía.
export function isPublicFileKey(key: string): boolean {
  return /^brand\/[A-Za-z0-9._-]{1,160}$/.test(key);
}

export function fileUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function absoluteFileUrl(key: string | null | undefined): string | null {
  const relative = fileUrl(key);
  if (!relative) return null;
  const base = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  return base ? `${base}${relative}` : relative;
}
