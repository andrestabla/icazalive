#!/usr/bin/env bash
# SendGrid como proveedor de correo saliente en Integraciones. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-sendgrid.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
# md5 de la versión anterior de cada archivo propio (HEAD~ local). Si Replit
# tiene otra cosa, se respalda antes de copiar y se avisa.
declare -A PREV=(
  ["lib/email-settings.ts"]="7fb8c0870f0527a2b7c799e3829fb1d9"
  ["app/api/email-settings/route.ts"]="fb30482313bba24e236e376ef550ccbd"
  ["app/integrations/smtp-email-panel.tsx"]="1067e7cff2315b0b607cacac5f21aad2"
  ["app/integrations/config-cards.tsx"]="ef4fb18b7d87006fe01db751cc9b634d"
)
for rel in "${!PREV[@]}"; do
  if [ -f "$rel" ]; then
    cur=$(md5sum "$rel" | cut -d' ' -f1)
    if [ "$cur" != "${PREV[$rel]}" ]; then
      mkdir -p /tmp/icaza-prev && cp "$rel" "/tmp/icaza-prev/$(basename "$rel")"
      echo "AVISO $rel difería de la versión esperada; respaldo en /tmp/icaza-prev/"
    fi
  fi
  mkdir -p "$(dirname "$rel")"; cp "$SRC/$rel" "$rel"; echo "copiado $rel"
done
cp "$SRC/lib/sendgrid-sender.ts" lib/sendgrid-sender.ts; echo "copiado lib/sendgrid-sender.ts"
cp "$SRC/app/integrations/email-provider.css" app/integrations/email-provider.css; echo "copiado app/integrations/email-provider.css"
mkdir -p drizzle && cp "$SRC/drizzle/0035_adorable_wolf_cub.sql" drizzle/ 2>/dev/null || true
python3 "$SRC/scripts/apply-sendgrid.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
