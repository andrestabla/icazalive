#!/usr/bin/env bash
# Plantilla CSV de ejemplo en Invitar participantes. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-csv-template.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }
declare -A PREV=(
  ["app/participants/participant-inviter.tsx"]="f91d78199627e39fa8a0b5bc002da0dd"
  ["lib/help-guides.ts"]="c8fec65aededcf1d3e4130b4cfc7efe8"
)
for rel in "${!PREV[@]}"; do
  if [ -f "$rel" ] && [ "$(md5sum "$rel" | cut -d' ' -f1)" != "${PREV[$rel]}" ]; then
    mkdir -p /tmp/icaza-prev && cp "$rel" "/tmp/icaza-prev/$(basename "$rel")"
    echo "AVISO $rel difería de la versión esperada; respaldo en /tmp/icaza-prev/"
  fi
  copy "$rel"
done
copy app/participants/csv-template.css
copy public/plantilla-participantes.csv
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
