#!/usr/bin/env python3
"""Marca: logos claro/oscuro, favicon y loader subidos a S3 (brand/), proxy
/api/files, presign por módulo, contenidos bajo content/. Copia los archivos
propios verificando por md5 que Replit no los modificó; para los archivos
divergentes (schema, globals.css) aplica ediciones ancladas."""
import hashlib, os, shutil, sys

SRC = os.environ.get("SRC", "/tmp/icazalive-feat-aws-ivs-s3")
def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest() if os.path.exists(p) else None

# md5 de la versión previa (antes de este cambio) de cada archivo propio.
EXPECTED_OLD = {
    "app/brand/brand-editor.tsx": "04ac7f2b8813cb888af354092f969f8a",
    "app/components/admin-sidebar.tsx": "c78299396b5469fb5009b668f602cb59",
    "app/layout.tsx": "4ae1b724d5c9380a00056c6717e23d8a",
    "lib/brand.ts": "2355e7d5afecd05759986ebbd7079e7b",
    "lib/brand-config.ts": "7c2a4775b9af7213b28288c2480f2304",
    "app/api/brand/route.ts": "0da5c509fdff767e2e46df4119ac6aa0",
    "lib/email-branding.ts": "2757280afa6b655da645dbfc372fcb11",
    "app/help/help-center-client.tsx": "46da18c2db455084f39dc8be21e4e210",
    "app/components/public-brand.tsx": "36b65ea94d05761131c3e0ceab180b04",
    "app/api/content-assets/route.ts": "fd5d7aaaa8b7568837d6e2b7dbadcdfa",
    "app/api/content-assets/upload-url/route.ts": "4b64931d783933ec58276ed2065eaf74",
    "app/content/content-library.tsx": "704cb5feeca08c83e890b27c22361e5e",
}

NEW_FILES = [
    "lib/uploads.ts",
    "app/api/uploads/presign/route.ts",
    "app/api/files/[...key]/route.ts",
    "app/components/brand-loader.tsx",
    "app/loading.tsx",
]

# Archivos cuya versión de Replit ya fue integrada en la nueva (se sobrescriben).
MERGED = {"app/brand/brand-editor.tsx", "app/components/public-brand.tsx"}

problems = []
for rel in NEW_FILES + list(EXPECTED_OLD):
    src = os.path.join(SRC, rel)
    if not os.path.exists(src):
        problems.append(f"falta en el tarball: {rel}"); continue
    current = md5(rel)
    if current == md5(src):
        print("al día", rel); continue
    if rel in EXPECTED_OLD and rel not in MERGED and current is not None and current != EXPECTED_OLD[rel]:
        problems.append(f"DIVERGIÓ en Replit (no se sobrescribe): {rel}"); continue
    os.makedirs(os.path.dirname(rel) or ".", exist_ok=True)
    shutil.copyfile(src, rel); print("copiado", rel)

# Iconos del agente en el editor de marca (AdminIcon existe solo en Replit).
if os.path.exists("app/components/admin-icon.tsx"):
    p = "app/brand/brand-editor.tsx"; s = open(p, encoding="utf-8").read(); o = s
    if "AdminIcon" not in s:
        s = s.replace('import PublicBrandIdentity from "@/app/components/public-brand";', 'import { AdminIcon } from "@/app/components/admin-icon";\nimport PublicBrandIdentity from "@/app/components/public-brand";', 1)
        s = s.replace('Abrir página pública ↗', 'Abrir página pública <AdminIcon name="arrow-right" />', 1)
        s = s.replace('role="alert">ⓘ {error}', 'role="alert"><AdminIcon name="info" /> {error}', 1)
        s = s.replace('{brand.registrationButtonLabel} →</button>', '{brand.registrationButtonLabel} <AdminIcon name="arrow-right" /></button>', 1)
        s = s.replace('<span>✓</span>', '<span><AdminIcon name="check" /></span>', 1)
    if s != o:
        open(p, "w", encoding="utf-8").write(s); print("iconos AdminIcon aplicados en brand-editor.tsx")

# db/schema.ts (anclado)
p = "db/schema.ts"; s = open(p, encoding="utf-8").read()
if "logoLightKey" not in s:
    old = '  logoUrl: text("logo_url"),\n  primaryColor: text("primary_color").notNull().default("#24194F"),'
    if old not in s: problems.append("schema: ancla brand_settings no encontrada")
    else:
        s = s.replace(old, '  logoUrl: text("logo_url"),\n  logoLightKey: text("logo_light_key"),\n  logoDarkKey: text("logo_dark_key"),\n  faviconKey: text("favicon_key"),\n  loaderKey: text("loader_key"),\n  primaryColor: text("primary_color").notNull().default("#24194F"),', 1)
        open(p, "w", encoding="utf-8").write(s); print("ajustado db/schema.ts")

# globals.css (anexo)
css_src = open(os.path.join(SRC, "app/globals.css"), encoding="utf-8").read()
block = css_src[css_src.index("/* Marca: logotipos, favicon y loader subidos a S3 */"):]
p = "app/globals.css"; s = open(p, encoding="utf-8").read()
if ".brand-assets-grid" not in s:
    open(p, "a", encoding="utf-8").write("\n\n" + block); print("anexado globals.css")

if problems:
    print("\n".join("FALLO: " + x for x in problems)); sys.exit(1)
print("LISTO")
