#!/usr/bin/env bash
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-tz.sh
set -euo pipefail
export SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/scripts/apply-datetime-tz-replit.py" scripts/
python3 scripts/apply-datetime-tz-replit.py
cp "$SRC/scripts/apply-format-fixes-replit.py" scripts/
python3 scripts/apply-format-fixes-replit.py
cp "$SRC/app/layout.tsx" app/layout.tsx
cp "$SRC/app/api/auth/sso/callback/route.ts" app/api/auth/sso/callback/route.ts
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
