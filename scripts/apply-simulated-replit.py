#!/usr/bin/env python3
"""Contenido simulado: solo desde la biblioteca, siempre por IVS, emisión
automática a la hora del evento. Copia archivos propios y edita event-detail
por anclas (quita el panel de subida directa)."""
import os, re, shutil, sys
SRC = os.environ.get("SRC", "/tmp/icazalive-feat-aws-ivs-s3")
if os.path.isdir(SRC):
    for rel in ["lib/simulated-emitter.ts", "lib/communication-worker.ts", "app/api/cron/communications/route.ts",
                "app/api/events/[slug]/emitter/route.ts", "app/api/events/[slug]/content/route.ts",
                "app/events/[slug]/simulated-content-panel.tsx"]:
        os.makedirs(os.path.dirname(rel), exist_ok=True)
        shutil.copyfile(os.path.join(SRC, rel), rel); print("copiado", rel)

p = "db/schema.ts"; s = open(p, encoding="utf-8").read()
t = s.replace('simulatedDelivery: simulatedDelivery("simulated_delivery")\n    .notNull()\n    .default("direct")', 'simulatedDelivery: simulatedDelivery("simulated_delivery")\n    .notNull()\n    .default("streaming")', 1)
if t != s: open(p, "w", encoding="utf-8").write(t); print("ajustado db/schema.ts")

p = "app/events/[slug]/event-detail.tsx"; s = open(p, encoding="utf-8").read(); o = s
# quitar el panel de subida directa del evento simulado
s = re.sub(r'\n\s*\{event\.format === "simulated" && \(\s*<RecordedVideoPanel[\s\S]*?/>\s*\)\}', '', s, count=1)
s = s.replace('import RecordedVideoPanel from "./recorded-video-panel";\n', '', 1)
# pasar la redirección al panel de contenido
s = re.sub(r'<SimulatedContentPanel\s*\n(\s*)eventSlug=\{event\.slug\}\s*\n\s*isHybrid=\{event\.format === "hybrid"\}\s*\n(\s*)/>',
           lambda m: f'<SimulatedContentPanel\n{m.group(1)}eventSlug={{event.slug}}\n{m.group(1)}isHybrid={{event.format === "hybrid"}}\n{m.group(1)}postEventRedirectUrl={{event.postEventRedirectUrl}}\n{m.group(1)}onRedirectChange={{(value) => void patchEvent({{ postEventRedirectUrl: value }})}}\n{m.group(2)}/>', s, count=1)
if "RecordedVideoPanel" in s: print("FALLO: RecordedVideoPanel sigue en event-detail"); sys.exit(1)
if "postEventRedirectUrl={event.postEventRedirectUrl}" not in s: print("FALLO: props de redirección no insertadas"); sys.exit(1)
if s != o: open(p, "w", encoding="utf-8").write(s); print("ajustado event-detail.tsx")

css = '''

/* Contenido simulado: entrega fija por IVS */
.sim-delivery-fixed { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid #e6e2ee; border-radius: 10px; background: #fbfafd; margin: 4px 0 10px; }
.sim-delivery-fixed .service-logo.ivs { background: #fff3e6; color: #c25b00; font-size: 10px; font-weight: 800; }
.sim-delivery-fixed b { display: block; font-size: 13px; }
.sim-delivery-fixed small { color: #817b8d; font-size: 11px; }
'''
p = "app/globals.css"; s = open(p, encoding="utf-8").read()
if ".sim-delivery-fixed" not in s: open(p, "a", encoding="utf-8").write(css); print("anexado CSS")
print("LISTO")
