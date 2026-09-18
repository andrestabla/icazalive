#!/usr/bin/env bash
# Zoom automático al confirmar eventos en vivo/híbridos. NO copia lib/zoom.ts
# (en Replit manda la versión del conector de Replit). Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-zoom-auto.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
for rel in "lib/zoom-automation.ts" "app/api/events/[slug]/route.ts"; do
  cp "$SRC/$rel" "$rel"; echo "copiado $rel"
done
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
