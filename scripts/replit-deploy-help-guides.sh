#!/usr/bin/env bash
# Centro de ayuda: guías paso a paso con capturas. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-help-guides.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
declare -A PREV=(
  ["lib/help-content.ts"]="0406aa166cccf7cc7317cc52e8b2e394"
  ["app/help/help-center-client.tsx"]="d8fd3d217651f58f4d4de66a60f44680"
  ["app/components/help-widget.tsx"]="bb31726d160929c19135a163df4ca0cf"
)
for rel in "${!PREV[@]}"; do
  if [ -f "$rel" ]; then
    cur=$(md5sum "$rel" | cut -d' ' -f1)
    if [ "$cur" != "${PREV[$rel]}" ]; then
      mkdir -p /tmp/icaza-prev && cp "$rel" "/tmp/icaza-prev/$(basename "$rel")"
      echo "AVISO $rel difería de la versión esperada; respaldo en /tmp/icaza-prev/"
    fi
  fi
  cp "$SRC/$rel" "$rel"; echo "copiado $rel"
done
cp "$SRC/lib/help-guides.ts" lib/help-guides.ts; echo "copiado lib/help-guides.ts"
cp "$SRC/app/help/help-guide.css" app/help/help-guide.css; echo "copiado app/help/help-guide.css"
mkdir -p public/help && cp "$SRC"/public/help/*.jpg public/help/ && echo "copiadas $(ls public/help/*.jpg | wc -l) capturas"
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
