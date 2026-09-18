#!/usr/bin/env bash
# Widget de ayuda en móvil (sala) + la casilla "Grabar la sesión" gobierna la grabación en IVS.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-help-mobile.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
python3 "$SRC/scripts/apply-help-mobile-recording.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
