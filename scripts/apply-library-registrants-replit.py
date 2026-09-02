#!/usr/bin/env python3
"""Biblioteca: vista previa y renombrado (BD + S3). Pestaña Registro: lista
de inscritos del evento con modal "Ver todos". Copia archivos propios y
edita event-detail por anclas."""
import os, re, shutil, sys
SRC = os.environ.get("SRC", "/tmp/icazalive-feat-aws-ivs-s3")
if os.path.isdir(SRC):
    for rel in ["lib/aws-s3.ts", "app/api/content-assets/route.ts", "app/api/content-assets/preview/route.ts",
                "app/content/content-library.tsx", "app/events/[slug]/event-registrants.tsx"]:
        os.makedirs(os.path.dirname(rel), exist_ok=True)
        shutil.copyfile(os.path.join(SRC, rel), rel); print("copiado", rel)

p = "app/events/[slug]/event-detail.tsx"; s = open(p, encoding="utf-8").read(); o = s
if "EventRegistrants" not in s:
    s = s.replace('import EventDateEditor from "./event-date-editor";', 'import EventDateEditor from "./event-date-editor";\nimport EventRegistrants from "./event-registrants";', 1)
    # tras la tarjeta resumen de registro (enlace "Ver participantes")
    m = re.search(r'(<Link href="/participants">Ver participantes[^\n]*</Link>\s*\n(\s*)</section>)', s)
    if not m: print("FALLO: ancla Ver participantes"); sys.exit(1)
    indent = m.group(2)
    s = s.replace(m.group(1), m.group(1) + f'\n{indent}<EventRegistrants eventSlug={{event.slug}} refreshKey={{registrationCount}} />', 1)
if "EventRegistrants eventSlug" not in s: print("FALLO: EventRegistrants no insertado"); sys.exit(1)
if s != o: open(p, "w", encoding="utf-8").write(s); print("ajustado event-detail.tsx")

css_src = open(os.path.join(SRC, "app/globals.css"), encoding="utf-8").read() if os.path.isdir(SRC) else open("app/globals.css", encoding="utf-8").read()
marker = "/* Biblioteca: vista previa y renombrado */"
block = css_src[css_src.index(marker):]
p = "app/globals.css"; s = open(p, encoding="utf-8").read()
if marker not in s: open(p, "a", encoding="utf-8").write("\n\n" + block); print("anexado CSS")
print("LISTO")
