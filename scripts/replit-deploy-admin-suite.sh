#!/usr/bin/env bash
# Suite de administración: perfil de usuario, idioma inglés, foto de Google,
# edición de miembros y reenvío de credenciales, alcance en analítica y
# contenidos, filtros del administrador y tarjeta de próximos eventos.
# ANTES de Republish, ejecutar en las bases Development y Production (consola SQL):
#   ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" text;
#   ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
#   ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_source" text;
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-admin-suite.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
mkdir -p lib/i18n app/profile app/api/auth/profile
for f in lib/i18n/locale.ts lib/i18n/server.ts lib/i18n/rules.ts lib/i18n/runtime.tsx lib/i18n/en.ts lib/i18n/en-extra.json \
         app/profile/layout.tsx app/profile/page.tsx app/profile/profile-editor.tsx app/profile/profile.css \
         app/api/auth/profile/route.ts app/analytics/analytics-filters.tsx \
         scripts/i18n-extract.mjs scripts/i18n-build.mjs \
         drizzle/0040_steady_may_parker.sql drizzle/meta/0040_snapshot.json; do
  cp "$SRC/$f" "$f" && echo "copiado $f"
done
python3 - <<'PY'
import json, pathlib
p = pathlib.Path("drizzle/meta/_journal.json"); j = json.loads(p.read_text())
if not any(e["tag"] == "0040_steady_may_parker" for e in j["entries"]):
    last = j["entries"][-1]
    j["entries"].append({"idx": last["idx"] + 1, "version": last["version"], "when": last["when"] + 1, "tag": "0040_steady_may_parker", "breakpoints": True})
    p.write_text(json.dumps(j, indent=2) + "\n"); print("journal: 0040 añadida")
else: print("journal: 0040 ya estaba")
PY
python3 "$SRC/scripts/apply-admin-suite.py" .
echo "--- textos de esta copia sin traducción (informativo)"
node scripts/i18n-extract.mjs . --missing 2>&1 >/tmp/i18n-missing.json | tail -1
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
