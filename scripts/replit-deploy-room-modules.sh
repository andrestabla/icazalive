#!/usr/bin/env bash
# Módulos de la sala configurables + limpieza de textos de desarrollo. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-room-modules.sh
# ANTES del Republish, en AMBAS bases (Development y Production), una sentencia por vez:
#   ALTER TABLE events ADD COLUMN IF NOT EXISTS room_modules jsonb NOT NULL DEFAULT '{"chat":true,"questions":true,"polls":true,"resources":true,"reactions":true}'::jsonb;
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }
declare -A PREV=(
  ["lib/room-stream.ts"]="73986721279ad5e5c8d750eff44ad08e"
  ["app/api/events/[slug]/route.ts"]="5916ee08f7b4a109887cce65b9f5a390"
)
for rel in "${!PREV[@]}"; do
  if [ -f "$rel" ] && [ "$(md5sum "$rel" | cut -d' ' -f1)" != "${PREV[$rel]}" ]; then
    mkdir -p /tmp/icaza-prev && cp "$rel" "/tmp/icaza-prev/$(basename "$rel")"
    echo "AVISO $rel difería de la versión esperada; respaldo en /tmp/icaza-prev/"
  fi
  copy "$rel"
done
copy lib/room-modules.ts
copy "app/events/[slug]/room-modules-panel.tsx"
copy app/events/room-modules.css
copy "app/room/[slug]/room-modules.css"
copy "app/events/[slug]/studio/studio-technical-test.tsx"
python3 "$SRC/scripts/apply-room-modules.py" .
python3 "$SRC/scripts/apply-copy-cleanup.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
