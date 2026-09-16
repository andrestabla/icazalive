import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las respuestas (HSTS, sin sniffing de
// tipos, sin incrustar en iframes de terceros, Referer solo con el origen y
// APIs del navegador sensibles desactivadas). La CSP se aplica por separado.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // Replit sirve el dev server detrás de un dominio *.replit.dev; sin esto
  // Next bloquea los recursos de desarrollo cross-origin y React no hidrata.
  allowedDevOrigins: [
    "*.replit.dev",
    "*.repl.co",
    "127.0.0.1",
    "localhost",
    ...(process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : []),
  ],
};

export default nextConfig;
