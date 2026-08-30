// Origen público de la aplicación para construir enlaces enviados por correo.
// Detrás de un proxy (Replit Autoscale) la URL de la petición apunta al
// servidor interno (0.0.0.0:3000), así que APP_BASE_URL manda en producción.
export function getPublicOrigin(request: Request): string {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const protocol = request.headers.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}
