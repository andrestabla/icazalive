#!/usr/bin/env bash
# Endurecimiento de seguridad: cabeceras, token fuera de la URL de la sala, límites de peticiones,
# autorización por evento, cuentas del equipo protegidas, MFA con bloqueo, subidas y archivos endurecidos.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-security.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/lib/rate-limit.ts" lib/rate-limit.ts && echo "copiado lib/rate-limit.ts"
python3 "$SRC/scripts/apply-security-hardening.py" .
python3 "$SRC/scripts/apply-security-authz.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
