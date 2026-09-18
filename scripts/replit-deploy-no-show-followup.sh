#!/usr/bin/env bash
# Automatización "Recordatorio oportunidad" (solo para inscritos que no entraron, con botón de
# Calendly si hay enlace) y duración de eventos libre en minutos (5 a 720).
# ANTES de Republish, ejecutar en las bases Development y Production (consola SQL):
#   ALTER TYPE "public"."communication_type" ADD VALUE IF NOT EXISTS 'no_show_followup';
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-no-show-followup.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/lib/communication-backfill.ts" lib/communication-backfill.ts && echo "copiado communication-backfill.ts"
cp "$SRC/app/events/duration-input.tsx" app/events/duration-input.tsx && echo "copiado duration-input.tsx"
cp "$SRC/drizzle/0039_overjoyed_jasper_sitwell.sql" drizzle/ && cp "$SRC/drizzle/meta/0039_snapshot.json" drizzle/meta/ && echo "copiada migración 0039"
python3 - <<'PY'
import json, pathlib
p = pathlib.Path("drizzle/meta/_journal.json"); j = json.loads(p.read_text())
if not any(e["tag"] == "0039_overjoyed_jasper_sitwell" for e in j["entries"]):
    last = j["entries"][-1]
    j["entries"].append({"idx": last["idx"] + 1, "version": last["version"], "when": last["when"] + 1, "tag": "0039_overjoyed_jasper_sitwell", "breakpoints": True})
    p.write_text(json.dumps(j, indent=2) + "\n"); print("journal: 0039 añadida")
else: print("journal: 0039 ya estaba")
PY
python3 "$SRC/scripts/apply-no-show-followup.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
