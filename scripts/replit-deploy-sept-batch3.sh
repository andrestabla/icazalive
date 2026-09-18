#!/usr/bin/env bash
# Lote 3: cierre de la sala con mensaje editable, cerrar desde la sala técnica,
# línea de tiempo del contenido simulado, aviso SSE de estado, sin widget de ayuda en la sala.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-sept-batch3.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }
copy lib/room-modules.ts
copy "app/events/[slug]/room-modules-panel.tsx"
python3 "$SRC/scripts/apply-sept-batch3.py" .
python3 "$SRC/scripts/apply-help-guides-sept3.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
