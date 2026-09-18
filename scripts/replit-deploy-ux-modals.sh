#!/usr/bin/env bash
# UX: modal de confirmación/error tras guardar, texto de presentación editable, formularios en modales.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-ux-modals.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/lib/feedback.ts" lib/feedback.ts && echo "copiado lib/feedback.ts"
cp "$SRC/app/components/feedback-dialog.tsx" app/components/feedback-dialog.tsx && echo "copiado feedback-dialog.tsx"
python3 "$SRC/scripts/apply-ux-modals.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
