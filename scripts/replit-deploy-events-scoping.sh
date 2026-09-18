#!/usr/bin/env bash
# Alcance por organizador (eventos y participantes), filtro por organizador para el administrador
# y modal de creación de eventos en /events.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-events-scoping.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/app/events/event-creator.tsx" app/events/event-creator.tsx && echo "copiado event-creator.tsx"
python3 "$SRC/scripts/apply-events-scoping.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
