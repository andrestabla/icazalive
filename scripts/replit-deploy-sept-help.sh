#!/usr/bin/env bash
# Comunicaciones: "Reintentar con error" + centro de ayuda con las funciones de
# septiembre (capturas nuevas) + texto de reacciones en la sala.
#   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-sept-help.sh
set -euo pipefail
SRC=/tmp/icazalive-feat-aws-ivs-s3
mkdir -p public/help
for f in registro-compartir registro-fondo registro-campos-base registro-publico-nuevo comunicaciones-cola comunicaciones-agendar transmision-zoom-ivs transmision-biblioteca interaccion-modulos participantes-plantilla participantes-invitar-csv sala-reacciones; do
  cp "$SRC/public/help/$f.jpg" "public/help/$f.jpg" && echo "copiada $f.jpg"
done
python3 "$SRC/scripts/apply-help-guides-sept.py" .
python3 "$SRC/scripts/apply-retry-failed.py" .
python3 "$SRC/scripts/apply-copy-cleanup.py" .
npx tsc --noEmit -p . && echo TSC_OK
npm run build 2>&1 | tail -3
echo DEPLOY_PREP_DONE
