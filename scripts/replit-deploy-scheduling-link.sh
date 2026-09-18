#!/usr/bin/env bash
# Enlace de agendamiento (Calendly) en el seguimiento posterior. Uso en Replit:
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/refs/heads/feat/aws-ivs-s3 | tar xz -C /tmp && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-scheduling-link.sh
# ANTES del Republish, crear la columna en AMBAS bases (Development y Production) desde la consola SQL:
#   ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduling_url text;
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
copy() { mkdir -p "$(dirname "$1")"; cp "$SRC/$1" "$1"; echo "copiado $1"; }
# md5 de la versión anterior de los archivos existentes; si Replit tiene otra
# cosa, se respalda y se avisa (no se aborta: son archivos propios).
declare -A PREV=(
  ["lib/communication-worker.ts"]="a60cb0aef15612726fcc203959f15a9e"
  ["lib/email-branding.ts"]="96c20b38ae55c61ca41315fa2dad268f"
  ["lib/default-communications.ts"]="f56df453968f7d15ebb6ab65a2c150bb"
  ["app/api/auth/preferences/route.ts"]="1d0789ff1248b1201e4b397f8f5f3f3b"
)
for rel in "${!PREV[@]}"; do
  if [ -f "$rel" ] && [ "$(md5sum "$rel" | cut -d' ' -f1)" != "${PREV[$rel]}" ]; then
    mkdir -p /tmp/icaza-prev && cp "$rel" "/tmp/icaza-prev/$(basename "$rel")"
    echo "AVISO $rel difería de la versión esperada; respaldo en /tmp/icaza-prev/"
  fi
  copy "$rel"
done
copy lib/scheduling-link.ts
copy "app/api/events/[slug]/scheduling-link/route.ts"
copy app/events/scheduling-link.css
python3 - <<'EOF'
p="db/schema.ts"; s=open(p).read()
if "schedulingUrl" not in s:
    old='  timezone: text("timezone"),\n'
    assert old in s, "ANCLA NO ENCONTRADA: users.timezone"
    s=s.replace(old, old+'  schedulingUrl: text("scheduling_url"),\n',1); open(p,"w").write(s); print("OK schema: scheduling_url")
else:
    print("OK schema: ya tenía scheduling_url")
EOF
python3 "$SRC/scripts/apply-scheduling-link.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
