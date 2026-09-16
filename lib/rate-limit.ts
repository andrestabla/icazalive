// Límite de peticiones en memoria (ventana deslizante) para los puntos
// públicos que pueden abusarse: inicio de sesión, registro y acciones de la
// sala. Es por instancia (en Autoscale cada máquina lleva su propio contador),
// suficiente para frenar scripts simples y ráfagas; el bloqueo de cuenta tras
// 5 intentos fallidos sigue siendo la defensa principal del login.

type Bucket = number[];

const globalStore = globalThis as unknown as { __icazaRateLimit?: Map<string, Bucket> };

function store(): Map<string, Bucket> {
  if (!globalStore.__icazaRateLimit) globalStore.__icazaRateLimit = new Map();
  return globalStore.__icazaRateLimit;
}

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Devuelve true si la petición supera `limit` eventos en `windowMs` para la
 * clave dada (por ejemplo "login:1.2.3.4"). Registra el evento actual.
 */
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const buckets = store();
  const bucket = (buckets.get(key) ?? []).filter((at) => now - at < windowMs);
  if (bucket.length >= limit) {
    buckets.set(key, bucket);
    return true;
  }
  bucket.push(now);
  buckets.set(key, bucket);
  // Limpieza ocasional para que el mapa no crezca sin límite.
  if (buckets.size > 5000 && Math.random() < 0.01) {
    for (const [k, v] of buckets) {
      if (!v.some((at) => now - at < windowMs)) buckets.delete(k);
    }
  }
  return false;
}
