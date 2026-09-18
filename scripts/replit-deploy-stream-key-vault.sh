#!/usr/bin/env bash
# Clave de emisión guardada cifrada. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-stream-key-vault.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/lib/secret-box.ts" lib/secret-box.ts; echo "copiado lib/secret-box.ts"
cp "$SRC/lib/aws-ivs.ts" lib/aws-ivs.ts; echo "copiado lib/aws-ivs.ts"
cp "$SRC/lib/ivs-automation.ts" lib/ivs-automation.ts; echo "copiado lib/ivs-automation.ts"
mkdir -p drizzle && cp "$SRC/drizzle/0034_absent_nick_fury.sql" drizzle/ 2>/dev/null || true
python3 "$SRC/scripts/apply-stream-key-vault.py" .
if ! grep -q "^SECRET_BOX_KEY=" .env 2>/dev/null; then
  openssl rand -hex 32 | sed 's/^/SECRET_BOX_KEY=/' >> .env
  echo "SECRET_BOX_KEY generada en .env (no se muestra)"
else
  echo "SECRET_BOX_KEY ya existía"
fi
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
