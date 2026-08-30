#!/bin/sh
# Empuja el contenido de SOURCE_URL al canal de IVS. Recodifica a un perfil
# estable de 1080p30 para que IVS transcodifique a calidades ABR. Si LOOP=1,
# repite el contenido hasta que la tarea se detenga (útil para pruebas).
set -eu

: "${SOURCE_URL:?falta SOURCE_URL}"
: "${INGEST_ENDPOINT:?falta INGEST_ENDPOINT}"
: "${STREAM_KEY:?falta STREAM_KEY}"
LOOP="${LOOP:-0}"

# INGEST_ENDPOINT llega como rtmps://host:443/app/ ; se le concatena la clave.
TARGET="${INGEST_ENDPOINT}${STREAM_KEY}"

LOOP_ARGS=""
if [ "$LOOP" = "1" ]; then
  LOOP_ARGS="-stream_loop -1"
fi

# -re: leer a la velocidad real (streaming en vivo, no a máxima velocidad).
exec ffmpeg -hide_banner -loglevel warning \
  $LOOP_ARGS -re -i "$SOURCE_URL" \
  -c:v libx264 -preset veryfast -profile:v main -pix_fmt yuv420p \
  -b:v 4500k -maxrate 4500k -bufsize 9000k -g 60 -r 30 \
  -c:a aac -b:a 128k -ar 44100 \
  -f flv "$TARGET"
