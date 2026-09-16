import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Cifrado simétrico AES-256-GCM para la contraseña SMTP almacenada en la base.
// La clave se deriva de AUTH_ENCRYPTION_KEY; si no está definida, se usa una
// derivación local de respaldo (solo desarrollo). El formato guardado es
// iv:authTag:ciphertext en base64.

let warnedMissingKey = false;

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_ENCRYPTION_KEY;
  if (!secret) {
    // Sin clave propia se usa una derivación fija: en producción queda
    // registrado en los logs para que se defina AUTH_ENCRYPTION_KEY.
    if (process.env.NODE_ENV === "production" && !warnedMissingKey) {
      warnedMissingKey = true;
      console.error("[email-crypto] AUTH_ENCRYPTION_KEY no está definida: los secretos guardados se cifran con la clave de respaldo del código.");
    }
    return createHash("sha256").update("icaza-live-local-fallback-key").digest();
  }
  // SHA-256 garantiza 32 bytes exactos para AES-256, sea cual sea la longitud.
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(stored: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = stored.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
