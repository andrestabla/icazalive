#!/usr/bin/env bash
# Canal de IVS automático al confirmar + panel "Datos de emisión". Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-ivs-auto.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/lib/aws-ivs.ts" lib/aws-ivs.ts; echo "copiado lib/aws-ivs.ts"
cp "$SRC/lib/ivs-automation.ts" lib/ivs-automation.ts; echo "copiado lib/ivs-automation.ts"
cp "$SRC/app/events/broadcast-details.css" app/events/broadcast-details.css; echo "copiado broadcast-details.css"
python3 "$SRC/scripts/apply-ivs-auto.py" .
python3 "$SRC/scripts/apply-broadcast-panel.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
