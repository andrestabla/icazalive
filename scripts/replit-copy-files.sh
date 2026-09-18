#!/usr/bin/env bash
# Copia archivos propios (no divergentes) desde el tarball de la rama y compila.
# Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-copy-files.sh app/layout.tsx app/api/auth/sso/callback/route.ts
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
for rel in "$@"; do
  mkdir -p "$(dirname "$rel")"
  cp "$SRC/$rel" "$rel"
  echo "copiado $rel"
done
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
