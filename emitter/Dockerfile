# Emisor efímero: lee un MP4 desde una URL (S3 prefirmada) y lo empuja a IVS
# por RTMPS. Se ejecuta como tarea Fargate mientras dura el segmento simulado.
FROM alpine:3.20

RUN apk add --no-cache ffmpeg ca-certificates

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
