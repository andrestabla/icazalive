#!/usr/bin/env bash
# Portada pública en la raíz del dominio. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-public-home.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/app/public-home.tsx" app/public-home.tsx; echo "copiado app/public-home.tsx"
cp "$SRC/app/public-home.css" app/public-home.css; echo "copiado app/public-home.css"
python3 "$SRC/scripts/apply-public-home.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
