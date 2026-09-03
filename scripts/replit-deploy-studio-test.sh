#!/usr/bin/env bash
# Prueba técnica real en la sala técnica. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-studio-test.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
for rel in "app/events/[slug]/studio/studio-technical-test.tsx" "app/room/[slug]/room-client.tsx" "app/api/public/events/[slug]/room/route.ts" "app/api/events/[slug]/emitter/route.ts" "lib/simulated-emitter.ts"; do
  mkdir -p "$(dirname "$rel")"; cp "$SRC/$rel" "$rel"; echo "copiado $rel"
done
python3 "$SRC/scripts/apply-studio-test.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
