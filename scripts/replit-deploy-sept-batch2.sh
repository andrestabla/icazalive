#!/usr/bin/env bash
# Lote 2 de septiembre: asistencia automática, eliminar participante (admin),
# página "Añadir al calendario", momento del seguimiento posterior, menús adaptativos,
# y centro de ayuda actualizado.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-sept-batch2.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }
copy lib/attendance.ts
copy "app/api/participants/[id]/route.ts"
copy "app/calendar/[slug]/page.tsx"
copy app/calendar/calendar.css
python3 "$SRC/scripts/apply-sept-batch2.py" .
python3 "$SRC/scripts/apply-help-guides-sept2.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
