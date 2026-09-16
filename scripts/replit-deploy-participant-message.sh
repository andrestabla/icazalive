#!/usr/bin/env bash
# Participantes: selección múltiple y "Enviar mensaje" (plantilla o nuevo) con cabecera y pie de marca.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-participant-message.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
mkdir -p app/api/participants/message
cp "$SRC/app/api/participants/message/route.ts" app/api/participants/message/route.ts && echo "copiado app/api/participants/message/route.ts"
python3 "$SRC/scripts/apply-participant-message.py" .
python3 "$SRC/scripts/apply-help-guides-sept4.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
