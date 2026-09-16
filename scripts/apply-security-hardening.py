#!/usr/bin/env python3
"""Endurecimiento de seguridad (pentest sept 2026):
- next.config.ts: cabeceras de seguridad y sin X-Powered-By.
- Sala del participante: el enlace personal sale de la barra de direcciones
  (queda en sessionStorage) para no filtrarse por historial, capturas o Referer.
- Límite de peticiones: login (por IP) y registro público (por IP y por correo).
Anclado e idempotente. lib/rate-limit.ts se copia completo."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def patch(rel, pairs, marker):
    p = root / rel; s = p.read_text(encoding="utf-8")
    if marker in s: print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if old not in s: print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8"); print(f"OK {rel}: aplicado")

# 1. Cabeceras de seguridad
patch("next.config.ts", [
    ('const nextConfig: NextConfig = {\n  serverExternalPackages: ["@electric-sql/pglite"],',
     '// Cabeceras de seguridad para todas las respuestas (HSTS, sin sniffing de\n'
     '// tipos, sin incrustar en iframes de terceros, Referer solo con el origen y\n'
     '// APIs del navegador sensibles desactivadas). La CSP se aplica por separado.\n'
     'const securityHeaders = [\n'
     '  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },\n'
     '  { key: "X-Content-Type-Options", value: "nosniff" },\n'
     '  { key: "X-Frame-Options", value: "DENY" },\n'
     '  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },\n'
     '  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },\n'
     '  { key: "X-DNS-Prefetch-Control", value: "on" },\n'
     '];\n\n'
     'const nextConfig: NextConfig = {\n  serverExternalPackages: ["@electric-sql/pglite"],\n'
     '  poweredByHeader: false,\n'
     '  async headers() {\n    return [{ source: "/(.*)", headers: securityHeaders }];\n  },'),
], "Strict-Transport-Security")

# 2. Token fuera de la URL de la sala
patch("app/room/[slug]/page.tsx", [
    ("      accessToken={access ?? null}", "      initialAccessToken={access ?? null}"),
], "initialAccessToken")

ROOM_OLD = (
    "export default function RoomClient({\n  eventShell,\n  accessToken,\n  brand,\n}: {\n"
    "  eventShell: {\n    title: string;\n    slug: string;\n    startsAt: string;\n    timezone: string;\n  };\n"
    "  accessToken: string | null;\n  brand: PublicBrand;\n}) {\n  const [room, setRoom] = useState<RoomData | null>(null);"
)
ROOM_NEW = (
    "export default function RoomClient({\n  eventShell,\n  initialAccessToken,\n  brand,\n}: {\n"
    "  eventShell: {\n    title: string;\n    slug: string;\n    startsAt: string;\n    timezone: string;\n  };\n"
    "  initialAccessToken: string | null;\n  brand: PublicBrand;\n}) {\n"
    "  // El enlace personal llega en la URL una sola vez: se guarda en la sesión\n"
    "  // del navegador y se retira de la barra de direcciones para que no quede en\n"
    "  // el historial, en capturas de pantalla ni en cabeceras Referer.\n"
    "  const storageKey = `icaza-room-access:${eventShell.slug}`;\n"
    "  const [accessToken, setAccessToken] = useState<string | null>(initialAccessToken);\n"
    "  useEffect(() => {\n    try {\n      if (initialAccessToken) {\n"
    "        window.sessionStorage.setItem(storageKey, initialAccessToken);\n"
    "        const url = new URL(window.location.href);\n"
    "        if (url.searchParams.has(\"access\")) {\n"
    "          url.searchParams.delete(\"access\");\n"
    "          window.history.replaceState(window.history.state, \"\", url.pathname + (url.search || \"\") + url.hash);\n"
    "        }\n      } else {\n"
    "        const stored = window.sessionStorage.getItem(storageKey);\n"
    "        if (stored) setAccessToken(stored);\n      }\n    } catch {\n"
    "      // Sin almacenamiento disponible: se sigue usando el token de la URL.\n    }\n"
    "  }, [initialAccessToken, storageKey]);\n"
    "  const [room, setRoom] = useState<RoomData | null>(null);"
)
patch("app/room/[slug]/room-client.tsx", [(ROOM_OLD, ROOM_NEW)], "icaza-room-access:")

# 3. Límite de peticiones en el login (por IP)
LOGIN_OLD = (
    "export async function POST(request: Request) {\n  const body = (await request.json()) as {\n"
    "    email?: string;\n    password?: string;\n    returnTo?: string;\n    totpCode?: string;\n  };"
)
LOGIN_NEW = (
    "export async function POST(request: Request) {\n"
    "  // Máximo 20 intentos por dirección IP cada 10 minutos (además del bloqueo\n"
    "  // de cuenta tras 5 fallos).\n"
    "  if (rateLimited(`login:${clientAddress(request)}`, 20, 10 * 60_000)) {\n"
    "    return NextResponse.json(\n"
    "      { error: \"Demasiados intentos. Espera unos minutos y vuelve a intentarlo.\" },\n"
    "      { status: 429, headers: { \"Retry-After\": \"600\" } },\n    );\n  }\n"
    "  const body = (await request.json()) as {\n"
    "    email?: string;\n    password?: string;\n    returnTo?: string;\n    totpCode?: string;\n  };"
)
patch("app/api/auth/login/route.ts", [
    ('import { createHash } from "node:crypto";', 'import { createHash } from "node:crypto";\nimport { clientAddress, rateLimited } from "@/lib/rate-limit";'),
    (LOGIN_OLD, LOGIN_NEW),
], "rateLimited(`login:")

# 4. Límite de registros públicos (por IP y por correo)
REG_ANCHOR = "  const db = getDb();\n  const [[event], legalDocuments] = await Promise.all(["
REG_GUARD = (
    "  // Protección contra registros masivos: 15 por IP cada 10 minutos y 3 por\n"
    "  // correo cada hora (cada registro dispara un correo de confirmación).\n"
    "  if (\n"
    "    rateLimited(`register:${clientAddress(request)}`, 15, 10 * 60_000) ||\n"
    "    rateLimited(`register-email:${email}`, 3, 60 * 60_000)\n"
    "  ) {\n"
    "    return NextResponse.json(\n"
    "      { error: \"Demasiadas solicitudes de registro. Inténtalo de nuevo en unos minutos.\" },\n"
    "      { status: 429, headers: { \"Retry-After\": \"600\" } },\n    );\n  }\n\n"
)
patch("app/api/public/events/[slug]/register/route.ts", [
    ('import { createRegistrationAccessToken } from "@/lib/registration-access";',
     'import { createRegistrationAccessToken } from "@/lib/registration-access";\nimport { clientAddress, rateLimited } from "@/lib/rate-limit";'),
    (REG_ANCHOR, REG_GUARD + REG_ANCHOR),
], "rateLimited(`register:")

print("LISTO endurecimiento")
