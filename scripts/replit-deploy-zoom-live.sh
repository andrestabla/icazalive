#!/usr/bin/env bash
# Despliegue combinado: vault de clave de emisión + SendGrid + Zoom → IVS
# gestionado desde la plataforma. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-zoom-live.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3

copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }

# --- Vault de clave de emisión (e0557ef) ---
copy lib/secret-box.ts
copy lib/aws-ivs.ts
copy lib/ivs-automation.ts
mkdir -p drizzle && cp "$SRC/drizzle/0034_absent_nick_fury.sql" drizzle/ 2>/dev/null || true
python3 "$SRC/scripts/apply-stream-key-vault.py" .
if ! grep -q "^SECRET_BOX_KEY=" .env 2>/dev/null; then
  openssl rand -hex 32 | sed 's/^/SECRET_BOX_KEY=/' >> .env
  echo "SECRET_BOX_KEY generada en .env (no se muestra)"
else
  echo "SECRET_BOX_KEY ya existía"
fi

# --- SendGrid (d20a718) ---
copy lib/email-settings.ts
copy lib/sendgrid-sender.ts
copy app/api/email-settings/route.ts
copy app/integrations/smtp-email-panel.tsx
copy app/integrations/config-cards.tsx
copy app/integrations/email-provider.css
cp "$SRC/drizzle/0035_adorable_wolf_cub.sql" drizzle/ 2>/dev/null || true
python3 "$SRC/scripts/apply-sendgrid.py" .

# --- Zoom → IVS desde la plataforma ---
copy lib/zoom-livestream.ts
copy lib/zoom-ivs-bridge.ts
copy lib/zoom-automation.ts
copy "app/api/events/[slug]/zoom-livestream/route.ts"
copy "app/events/[slug]/zoom-livestream-panel.tsx"
copy app/events/zoom-livestream.css
copy "app/events/[slug]/studio/studio-technical-test.tsx"
echo "--- firmas en lib/zoom.ts (referencia) ---"
grep -n "async function\|connectors" lib/zoom.ts | head -20 || true
python3 "$SRC/scripts/apply-zoom-livestream.py" .

npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
