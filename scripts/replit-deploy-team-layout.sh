#!/usr/bin/env bash
# Equipo: tabla sin scroll horizontal.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-team-layout.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
python3 "$SRC/scripts/apply-team-layout.py" .
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
