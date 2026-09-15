#!/usr/bin/env bash
# Miniatura al compartir el registro (Open Graph) + etiqueta neutra de la señal.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-og-preview.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }
copy "app/register/[slug]/opengraph-image.tsx"
copy lib/public-origin.ts
python3 "$SRC/scripts/apply-og-metadata.py" .
python3 "$SRC/scripts/apply-copy-cleanup.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
