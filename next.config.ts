import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Replit sirve el dev server detrás de un dominio *.replit.dev; sin esto
  // Next bloquea los recursos de desarrollo cross-origin y React no hidrata.
  allowedDevOrigins: [
    "*.replit.dev",
    "*.repl.co",
    ...(process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : []),
  ],
};

export default nextConfig;
