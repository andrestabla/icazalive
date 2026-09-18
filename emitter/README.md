# Emisor S3 → IVS

Imagen efímera que la aplicación lanza como tarea Fargate para transmitir un
contenido pregrabado (simulado) hacia un canal de IVS, obteniendo bitrate
adaptativo y experiencia de transmisión en vivo real ante miles de asistentes.

## Construir y publicar (una sola vez, y al cambiar el emisor)

Desde CloudShell, en la carpeta `emitter/`:

```sh
ACCOUNT=094275176968
REGION=us-east-1
REPO=icaza-live-emisor

aws ecr create-repository --repository-name $REPO 2>/dev/null || true
aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build -t $REPO .
docker tag $REPO:latest $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest

aws ecs register-task-definition --cli-input-json file://taskdef.json
```

La aplicación inyecta `SOURCE_URL`, `INGEST_ENDPOINT`, `STREAM_KEY` y `LOOP`
como overrides al lanzar la tarea; nunca se hornean en la imagen.
