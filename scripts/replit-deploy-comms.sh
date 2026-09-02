#!/usr/bin/env bash
# Despliegue en Replit: comunicaciones automáticas + zona horaria única.
# Uso (en la Shell de Replit, dentro de ~/workspace):
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-comms.sh
set -euo pipefail
export SRC=/tmp/icazalive-feat-aws-ivs-s3
cp "$SRC/scripts/apply-comms-replit.py" "$SRC/scripts/apply-timezone-replit.py" scripts/
python3 scripts/apply-comms-replit.py
python3 scripts/apply-timezone-replit.py
if ! grep -q '^CRON_SECRET=' .env 2>/dev/null; then
  echo "CRON_SECRET=$(openssl rand -hex 24)" >> .env
  echo "CRON_SECRET generado en .env"
fi
npm run db:generate 2>&1 | tail -1
M=$(ls -t drizzle/*.sql | head -1)
if ! grep -q 'America/Bogota' "$M"; then
  printf '%s\n' '--> statement-breakpoint' "UPDATE \"events\" SET \"timezone\" = 'America/New_York' WHERE \"timezone\" = 'America/Bogota';" >> "$M"
fi
echo "== $M"; cat "$M"; echo
npm run db:migrate 2>&1 | tail -1
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
