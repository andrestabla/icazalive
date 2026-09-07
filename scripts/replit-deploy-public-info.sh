#!/usr/bin/env bash
# Raíz -> /login y portada informativa en /info. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-public-info.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
mkdir -p app/info
cp "$SRC/app/public-home.tsx" app/public-home.tsx
cp "$SRC/app/public-home.css" app/public-home.css
cp "$SRC/app/info/page.tsx" app/info/page.tsx; echo "copiado app/info/page.tsx"
python3 "$SRC/scripts/apply-public-info-route.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
