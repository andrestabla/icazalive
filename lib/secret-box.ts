import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Cifrado simétrico para los pocos secretos que sí conviene guardar, como la
// clave de emisión de un canal de Amazon IVS. La clave maestra vive en la
// variable de entorno SECRET_BOX_KEY y nunca en la base: sin ella, lo guardado
// es indescifrable. Si la variable no está definida, el sistema sigue
// funcionando y simplemente no guarda nada.

const ALGORITHM = "aes-256-gcm";
const SALT = "icaza-live-secret-box";

function masterKey(): Buffer | null {
  const raw = process.env.SECRET_BOX_KEY;
  if (!raw || raw.length < 16) return null;
  return scryptSync(raw, SALT, 32);
}

export function secretBoxAvailable() {
  return masterKey() !== null;
}

// Devuelve "iv.tagDeAutenticidad.textoCifrado" en base64url, o null si no hay
// clave maestra configurada.
export function sealSecret(value: string): string | null {
  const key = masterKey();
  if (!key || !value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const sealed = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, sealed].map((part) => part.toString("base64url")).join(".");
}

export function openSecret(sealed: string | null | undefined): string | null {
  const key = masterKey();
  if (!key || !sealed) return null;
  const parts = sealed.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, payload] = parts.map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
  } catch {
    // Clave maestra distinta o dato manipulado: se trata como ausente.
    return null;
  }
}
