#!/usr/bin/env bash
# Sala sin scroll en escritorio, ayuda solo-soporte para participantes y
# redirección de cierre de sesión al dominio público. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-participant-polish.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }
copy app/api/auth/logout/route.ts
copy app/components/help-widget.tsx
copy app/help/help-center-client.tsx
copy app/help/help-guide.css
copy "app/room/[slug]/room-modules.css"
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
