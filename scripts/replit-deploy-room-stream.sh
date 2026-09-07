#!/usr/bin/env bash
# Sala en tiempo real sin avalancha + tope de calidad IVS. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-room-stream.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/lib/room-stream.ts" lib/room-stream.ts; echo "copiado lib/room-stream.ts"
cp "$SRC/app/room/[slug]/ivs-player.tsx" "app/room/[slug]/ivs-player.tsx"; echo "copiado ivs-player.tsx (tope de calidad)"
python3 "$SRC/scripts/apply-room-stream.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
