#!/usr/bin/env bash
# Despliegue en Replit: nombre de la plataforma (Icaza Jammoul Live).
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-name.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/scripts/apply-platform-name-replit.py" scripts/
python3 scripts/apply-platform-name-replit.py | tail -2
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
