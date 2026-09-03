#!/usr/bin/env bash
# Eliminar eventos (solo administradores) con registro en auditoría. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-event-delete.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/app/api/events/[slug]/route.ts" "app/api/events/[slug]/route.ts"; echo "copiado app/api/events/[slug]/route.ts"
cp "$SRC/lib/zoom-automation.ts" lib/zoom-automation.ts; echo "copiado lib/zoom-automation.ts"
python3 "$SRC/scripts/apply-event-delete.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
