#!/usr/bin/env bash
# Registro: campos base configurables, fondo de la página, compartir enlace,
# sin tipología para el participante y contenido destacado. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-registration-polish.sh
# ANTES del Republish, en AMBAS bases (Development y Production), una sentencia por vez:
#   ALTER TABLE events ADD COLUMN IF NOT EXISTS base_fields jsonb;
#   ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_background text;
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }
copy lib/registration-base-fields.ts
copy app/events/registration-tools.css
copy "app/events/[slug]/share-registration.tsx"
copy "app/events/[slug]/registration-background-panel.tsx"
# events route: propio, con respaldo si difiere
if [ -f "app/api/events/[slug]/route.ts" ] && [ "$(md5sum "app/api/events/[slug]/route.ts" | cut -d' ' -f1)" != "c0e49bf1ab1c72d33e6276855c038d67" ]; then
  mkdir -p /tmp/icaza-prev && cp "app/api/events/[slug]/route.ts" /tmp/icaza-prev/events-route.ts && echo "AVISO app/api/events/[slug]/route.ts difería; respaldo en /tmp/icaza-prev/"
fi
copy "app/api/events/[slug]/route.ts"
python3 "$SRC/scripts/apply-registration-polish.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
