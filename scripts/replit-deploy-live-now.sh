#!/usr/bin/env bash
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-live-now.sh
set -euo pipefail
export SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/scripts/apply-live-now-replit.py" scripts/
python3 scripts/apply-live-now-replit.py
npm run db:generate 2>&1 | tail -1
M=$(ls -t drizzle/*.sql | head -1); echo "== $M"; cat "$M"; echo
npm run db:migrate 2>&1 | tail -1
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
