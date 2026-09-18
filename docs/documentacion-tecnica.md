# Documentación técnica de la plataforma Icaza Jammoul Live

**Versión:** 18 de septiembre de 2026 · rama `feat/aws-ivs-s3`
**Producción:** `https://liveicazajammoul.com` (Replit Autoscale, región Sudamérica)
**Repositorio:** `github.com/andrestabla/icazalive` · carpeta local `icaza-live-app`

---

## 1. Visión general

Icaza Jammoul Live es una plataforma de eventos digitales para organizar, transmitir y medir webinars y sesiones corporativas. Cubre el ciclo completo: creación del evento, página pública de registro, comunicaciones automáticas por correo, sala del participante con video e interacción en tiempo real, moderación, cierre, analítica y cumplimiento de protección de datos.

Tres formatos de evento comparten la misma experiencia para el asistente:

| Formato | Fuente de video | Cómo llega al asistente |
|---|---|---|
| **En vivo** | Reunión de Zoom | Zoom emite por RTMPS a un canal de Amazon IVS; el reproductor de la sala consume HLS |
| **Simulado** | Video de la biblioteca (S3) | Una tarea de AWS ECS Fargate con ffmpeg lee el video y lo empuja al canal de IVS a la hora programada |
| **Híbrido** | Zoom y luego video | Igual que En vivo con conmutación al contenido simulado a un minuto configurado |

---

## 2. Infraestructura

```
Asistente / Organizador
        │ HTTPS
        ▼
Replit Autoscale (Next.js 16, Node)  ──►  Neon PostgreSQL (producción)
  2 vCPU · 4 GiB · hasta 3 máquinas        PGlite (desarrollo local)
        │
        ├──► Amazon IVS (canales, ingest RTMPS, reproducción HLS)
        │       ▲                 ▲
        │   Zoom (livestream)     │ ECS Fargate (emisor ffmpeg, eventos simulados)
        │                         │
        ├──► Amazon S3 (biblioteca de video, imágenes de marca, grabaciones IVS)
        ├──► SendGrid (correo saliente; conector administrado de Replit)
        ├──► Zoom API (conector administrado de Replit)
        └──► Google OAuth (inicio de sesión del equipo, opcional)
```

### 2.1 Replit
- **Deployment Autoscale**: escala de 0 a 3 máquinas según tráfico; cada máquina 2 vCPU / 4 GiB. Dominio propio con TLS gestionado por Replit; redirección HTTP → HTTPS.
- **Base de datos**: Neon PostgreSQL con dos instancias, *Development* y *Production*. Se apaga cuando la cuenta se queda sin créditos.
- **Secretos**: en Secrets del workspace (y de la publicación). Lista actual: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ECS_CLUSTER`, `AWS_ECS_EMITTER_TASK`, `AWS_ECS_SUBNETS`, `AWS_ECS_SECURITY_GROUPS`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_IVS_RECORDING_CONFIGURATION_ARN`, `SESSION_SECRET`. Pendientes recomendados: `AUTH_ENCRYPTION_KEY`, `SECRET_BOX_KEY`, `APP_BASE_URL`, `CRON_SECRET`.
- **Conectores administrados de Replit**: Zoom y SendGrid. El código accede con `ReplitConnectors().proxy("zoom" | "sendgrid", ruta, opciones)`; no hay claves de esos servicios en el código.
- **Publicación**: botón Republish tras preparar el código en la shell del workspace (ver sección 9).

### 2.2 AWS
- **IVS**: un canal por evento (`icaza-<slug>` o `icaza-sim-<slug>`), latencia baja o estándar según la sesión. Reproducción HLS pública firmada por IVS. Grabación opcional a S3 mediante *Recording Configuration* (ARN en secretos) cuando la sesión tiene "Grabar la sesión".
- **ECS Fargate**: definición de tarea del emisor (ffmpeg) que recibe por variables de entorno la URL firmada del video en S3, el endpoint de ingest y la clave del canal. Se lanza a la hora del evento y se detiene al terminar el video.
- **S3**: un bucket con prefijos `content/` (biblioteca), `brand/` (imágenes de marca y fondos, servidas por `/api/files`), `participants/` (subidas relacionadas con inscripciones) y `ivs/` (grabaciones). Las subidas se hacen con URL prefirmadas desde el navegador.
- **SES**: disponible como alternativa de correo; hoy no se usa (sandbox).
- **IAM**: un usuario de aplicación con permisos de IVS, ECS (RunTask, DescribeTasks, StopTask), S3 y SES. Las credenciales viven solo en Replit.

### 2.3 Terceros
- **Zoom**: reuniones creadas por API al confirmar el evento; destino de transmisión personalizado (RTMPS a IVS) configurado y arrancado por API. Requiere licencia con "Permitir la transmisión en vivo → Servicio personalizado" activado (documento `docs/zoom-permisos.md`).
- **SendGrid**: dominio `liveicazajammoul.com` autenticado (3 CNAME en Squarespace), remitente `live@liveicazajammoul.com`.
- **Google**: OAuth para inicio de sesión del equipo; secreto del cliente cifrado en base de datos.
- **Calendly**: solo un enlace por organizador, insertado en el correo de seguimiento.

---

## 3. Arquitectura de la aplicación

### 3.1 Tecnología
- **Next.js 16** (App Router, React 19), TypeScript, ejecución en Node.
- **Drizzle ORM** sobre PostgreSQL (`postgres` en producción, `@electric-sql/pglite` en desarrollo). Migraciones en `db/migrations` (`0001` a `0038`).
- **hls.js** para reproducción HLS con tope de calidad configurable (`NEXT_PUBLIC_IVS_MAX_HEIGHT`, 720p por defecto).
- **nodemailer** para el proveedor SMTP alternativo.
- Sin frameworks de UI: CSS propio en `app/globals.css` y hojas por módulo.

### 3.2 Estructura del repositorio

```
app/                    Páginas y rutas de API (App Router)
  (panel)               /events, /participants, /analytics, /content, /integrations,
                        /brand, /team, /permissions, /audit, /privacy, /help
  register/[slug]       Página pública de registro (+ imagen Open Graph)
  room/[slug]           Sala del participante
  manage-registration/  Autogestión de la inscripción
  calendar/[slug]       Añadir al calendario (Google, Outlook, Yahoo, .ics)
  events/[slug]/studio  Sala técnica del organizador
  api/                  Rutas de API (ver sección 6)
  components/           Widgets globales (ayuda, modal de confirmación, marca pública)
lib/                    Lógica de dominio (auth, permisos, correo, IVS, ECS, Zoom, S3,
                        comunicaciones, sala en tiempo real, asistencia, límites…)
db/                     schema.ts (Drizzle) y migraciones
scripts/                Semilla, backup y scripts de despliegue anclados (apply-*.py,
                        replit-deploy-*.sh)
docs/                   zoom-permisos.md, seguridad-pentest-2026-09.md
public/help/            Capturas del centro de ayuda
```

### 3.3 Capas
1. **Páginas (Server Components)** cargan datos con Drizzle y protegen el acceso por layout (`requirePermission`).
2. **Componentes cliente** (`*-client.tsx`, paneles) consumen las rutas de API con `fetch` y muestran el resultado con el modal de confirmación global (`lib/feedback.ts` + `FeedbackDialog`).
3. **Rutas de API** (`app/api/**/route.ts`) validan entrada, comprueban autenticación y autorización, escriben en la base y registran auditoría.
4. **Servicios de dominio** (`lib/*`) encapsulan integraciones externas y reglas: por ejemplo `simulated-emitter.ts`, `zoom-ivs-bridge.ts`, `communication-worker.ts`, `attendance.ts`.
5. **Trabajos en segundo plano**: un planificador interno (`instrumentation.ts`) ejecuta cada minuto la cola de correos y la automatización de eventos simulados; `after()` de Next dispara envíos tras responder; `/api/cron/communications` es el respaldo externo.

### 3.4 Tiempo real
- La sala abre un canal **Server-Sent Events** (`/api/public/events/[slug]/room/stream`). Un único observador por evento y proceso consulta la base cada 2 segundos y difunde a todos los suscriptores: mensajes de chat nuevos, avisos de preguntas, agregados de reacciones, cambios de módulos y cambios de estado del evento (en vivo / completado).
- El cliente conserva un sondeo de respaldo cada 60 segundos (8 si el canal cae) y un latido cada 25 segundos.
- Funciona con varias máquinas porque el observador lee de la base, no de memoria.

---

## 4. Modelo de datos (36 tablas)

| Grupo | Tablas | Notas |
|---|---|---|
| Identidad y acceso | `users`, `auth_sessions`, `role_permissions`, `user_permissions`, `mfa_backup_codes`, `identity_settings`, `google_sso_settings` | Contraseñas con scrypt; sesiones como hash SHA-256; MFA TOTP |
| Eventos | `events`, `event_organizers`, `event_templates`, `sessions` | `events.room_modules` (jsonb) guarda módulos activos y mensaje de cierre; `events.base_fields` la configuración de campos base; `sessions` guarda modo de transmisión, canal IVS, clave cifrada, estado del emisor |
| Inscripciones | `registrations`, `registration_access_tokens`, `event_registration_fields`, `registration_field_responses` | Estados: registered, confirmed, attended, absent, cancelled. Un token de acceso por inscripción (hash) |
| Comunicaciones | `communication_messages`, `communication_deliveries`, `outbound_email_settings` | Cinco tipos de mensaje por evento; entregas con cola, reintentos y errores |
| Interacción | `event_chat_messages`, `event_questions`, `question_votes`, `event_polls`, `poll_options`, `poll_votes`, `event_reactions`, `event_resources`, `event_participant_moderation`, `event_feedback_responses` | Moderación por inscripción (silenciar, bloquear) |
| Contenido y marca | `content_assets`, `brand_settings` | Biblioteca en S3 con duración; marca global y por evento |
| Integraciones | `integration_connections` | Estado de Zoom, AWS, correo; sin tokens |
| Cumplimiento | `audit_logs`, `legal_documents`, `consent_records`, `data_subject_requests`, `support_requests` | Auditoría encadenada por hash y verificable |

Convenciones: claves `uuid`, marcas de tiempo con zona, borrado en cascada desde `registrations` y `events`; los registros de consentimiento conservan la evidencia aunque se borre la persona (`set null`).

---

## 5. Funcionalidades

### 5.1 Panel del equipo
- **Resumen**: indicadores del día, próximos eventos, últimos movimientos.
- **Eventos**: lista y calendario; crear desde cero o desde plantilla; duplicar; eliminar (administrador). Estados: borrador → registro abierto → preparación → en vivo → completado / cancelado, con transiciones controladas.
- **Ficha del evento** (pestañas):
  - *Resumen*: datos, agenda de sesiones, estado, organizadores.
  - *Registro*: página pública (abrir, compartir por WhatsApp/LinkedIn/X/Instagram con miniatura Open Graph), texto de presentación, imagen de fondo (S3 o URL), colores del evento, cierre de inscripciones, plazo de autogestión, redirección posterior, campos del formulario (base y propios) en modales, lista de inscritos.
  - *Comunicaciones*: contadores de cola, "Procesar cola ahora", "Reintentar con error", cinco plantillas con variables, momento del seguimiento posterior, enlace de Calendly.
  - *Transmisión*: flujo (Zoom → IVS, IVS directo, simulado), latencia, grabación, panel Zoom → Amazon IVS de tres pasos, contenido de la biblioteca, emisor (iniciar/detener), datos de emisión para codificadores externos.
  - *Interacción*: módulos de la sala (chat, preguntas, encuestas, recursos, reacciones) con cambio en vivo, mensaje de cierre, moderación de chat y preguntas, encuestas, recursos.
  - *Analítica*: embudo de asistencia, participación, retroalimentación, exportación e informe.
- **Sala técnica**: vista previa de la señal tal como la ve el participante, prueba técnica sin emisión pública, línea de tiempo del contenido simulado, cerrar la sala, módulos y mensaje de cierre.
- **Participantes**: lista agrupada o por inscripción, filtros, historial por persona, cambio de estado, invitación individual o por CSV (plantilla descargable), selección múltiple con "Enviar mensaje" (plantilla del evento o mensaje nuevo, siempre con cabecera y pie de marca), exportación CSV/XLSX, eliminación definitiva (administrador).
- **Contenidos**: biblioteca de video en S3 con procesamiento y duración.
- **Integraciones**: Zoom, AWS (IVS, S3, ECS), correo saliente (SendGrid o SMTP), Google SSO.
- **Marca**: identidad, colores, logotipo, textos públicos, vista previa de correo.
- **Equipo y Permisos**: cuentas, roles, permisos granulares (`events.*`, `participants.*`, `content.*`, `brand.*`, `integrations.*`, `team.*`, `permissions.manage`, `privacy.*`, `audit.view`, `analytics.view`, `dashboard.view`).
- **Auditoría**: registro de acciones con verificación de integridad.
- **Privacidad**: documentos legales versionados, solicitudes de derechos, exportación y borrado.
- **Centro de ayuda**: guías paso a paso con capturas (eventos, participantes, analítica) para el equipo; soporte para participantes.

### 5.2 Experiencia del participante
- **Registro** público con campos configurables, consentimiento versionado, límite de peticiones y miniatura al compartir.
- **Correos** con marca: confirmación (enlace personal, calendario, autogestión), recordatorios, "ya estamos en vivo", seguimiento con botón de agendamiento.
- **Añadir al calendario**: página con Google Calendar, Outlook.com, Outlook empresarial, Yahoo y archivo .ics.
- **Sala**: lobby con cuenta regresiva, reproductor HLS adaptativo (tope 720p), chat, preguntas con votos, encuestas, recursos, reacciones; sin mención de la tecnología; sin scroll de página en escritorio; móvil adaptado; sin widget de ayuda. Al completarse el evento, pantalla de cierre con el mensaje del organizador y sala cerrada.
- **Autogestión**: editar datos o cancelar la inscripción con el enlace personal; retroalimentación al final.
- **Asistencia automática**: al entrar en vivo pasa a "Asistió"; al completar, quien no entró queda "No asistió".

### 5.3 Automatizaciones
- Creación de reunión de Zoom y canal de IVS al confirmar el evento; reprogramación al cambiar la fecha; renombrado `[CANCELADO]` al cancelar.
- Arranque y parada automáticos del emisor de eventos simulados; paso a en vivo y a completado.
- Cola de correos con reintentos exponenciales y cancelación de recordatorios vencidos.
- Cierre de asistencia al completar.

---

## 6. API interna (resumen)

Todas las rutas viven bajo `/api`. Las privadas exigen sesión (cookie `__Host-`) y, según el caso, permiso y pertenencia al evento (`canManageEvent`). Las públicas de participante exigen el token personal (`Authorization: Bearer` o `?access=`).

| Área | Rutas principales |
|---|---|
| Autenticación | `auth/login`, `auth/logout`, `auth/me`, `auth/mfa`, `auth/password`, `auth/preferences`, `auth/sso/google/start`, `auth/sso/callback`, `auth/sso/status` |
| Eventos | `events`, `events/[slug]`, `.../sessions`, `.../organizers`, `.../registration-fields`, `.../communications`, `.../communications/process`, `.../streaming`, `.../zoom-livestream`, `.../emitter`, `.../content`, `.../video`, `.../interaction`, `.../analytics`, `.../feedback`, `.../duplicate`, `.../scheduling-link`, `event-templates` |
| Participantes | `participants` (GET, PATCH), `participants/[id]` (DELETE, administrador), `participants/invite`, `participants/message` |
| Público (con token) | `public/events/[slug]/register` (sin token), `.../registration`, `.../room`, `.../room/stream` (SSE), `.../video`, `.../calendar`, `.../feedback` |
| Configuración | `brand`, `integrations`, `integrations/sso-google`, `email-settings`, `team`, `permissions`, `security-setup`, `legal-documents`, `data-rights`, `support-requests`, `audit`, `audit/verify`, `content-assets`, `uploads/presign`, `files/[...key]` |
| Operación | `cron/communications` (secreto), `health`, `dashboard` |

Convenciones: respuestas `{ data }` o `{ error }`; códigos 400 validación, 401 sin sesión, 403 sin permiso o sin pertenencia, 404, 409 conflicto de estado, 429 límite de peticiones.

---

## 7. Seguridad

- **Autenticación**: scrypt, sesiones de 256 bits con hash, cookie HttpOnly + Secure + SameSite, MFA TOTP con códigos de respaldo, bloqueo tras 5 fallos (también de MFA), límite de 20 intentos por IP cada 10 minutos, SSO de Google con validación de `state`.
- **Autorización**: rol + permisos granulares + pertenencia al evento en todas las rutas de evento; mensajes e invitaciones solo a eventos gestionados; eliminación de participantes y eventos reservada al administrador.
- **Cabeceras**: HSTS (2 años, preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`; sin `X-Powered-By`.
- **Datos del participante**: el enlace personal sale de la barra de direcciones al entrar a la sala; consentimiento versionado; borrado con evidencia conservada.
- **Subidas**: tipos y tamaño validados, sin SVG en marca, archivos servidos con `sandbox` y como adjunto si son HTML/SVG/XML; biblioteca limitada a `content/`.
- **Límites**: registro público 15 por IP cada 10 minutos y 3 por correo por hora; chat y reacciones con moderación y control de ráfagas.
- **Auditoría** encadenada y verificable.
- Informe completo y mejoras pendientes en `docs/seguridad-pentest-2026-09.md`.

---

## 8. Entorno de desarrollo

```bash
cd icaza-live-app
npm install
cp .env.example .env.local        # completar solo lo necesario
npm run db:migrate                # PGlite local (reiniciar el dev server después)
npm run db:seed                   # administrador local: andres@icazalive.local
npm run dev                       # http://localhost:3000
```

- `npm run build` y `npx tsc --noEmit -p .` antes de cada publicación.
- `npm run db:backup` / `db:restore` para copias de la base.
- La caché de desarrollo (`.next/dev`) puede quedarse con CSS antiguo tras editar `globals.css`; si un estilo nuevo no aparece, detener el servidor, borrar `.next/dev` y arrancar de nuevo.
- Pruebas de extremo a extremo con `puppeteer-core` y el Chrome del sistema (scripts en la carpeta de trabajo de la sesión).

---

## 9. Publicación en Replit

1. Confirmar y subir los cambios a la rama `feat/aws-ivs-s3`.
2. En la shell del workspace de Replit, descargar el commit y ejecutar el script de despliegue correspondiente:
   ```bash
   curl -sL https://codeload.github.com/andrestabla/icazalive/tar.gz/<sha> | tar xz -C /tmp \
     && mv /tmp/icazalive-<sha>* /tmp/icazalive-feat-aws-ivs-s3 \
     && bash /tmp/icazalive-feat-aws-ivs-s3/scripts/replit-deploy-<nombre>.sh
   ```
   Los scripts copian solo archivos propios y aplican parches anclados e idempotentes (`scripts/apply-*.py`) para no pisar lo que el agente de Replit haya cambiado (por ejemplo `participant-inviter.tsx`, `lib/zoom.ts`, los módulos de correo).
3. Si hay migraciones, crear las columnas antes en Development y Production desde la consola SQL de Replit (una sentencia por ejecución; usar `jsonb_build_object` en vez de `{}`), y cancelar si el diálogo de publicación propone borrar columnas.
4. Pulsar **Republish** y verificar en producción.
5. Los secretos nuevos se leen al publicar; las shells abiertas no los ven hasta abrir una nueva.

Scripts existentes (en orden histórico): `replit-deploy-zoom-live-only.sh`, `replit-deploy-help-guides.sh`, `replit-deploy-scheduling-link.sh`, `replit-deploy-room-modules.sh`, `replit-deploy-participant-polish.sh`, `replit-deploy-registration-polish.sh`, `replit-deploy-csv-template.sh`, `replit-deploy-og-preview.sh`, `replit-deploy-sept-help.sh`, `replit-deploy-sept-batch2.sh`, `replit-deploy-sept-batch3.sh`, `replit-deploy-team-layout.sh`, `replit-deploy-help-mobile.sh`, `replit-deploy-participant-message.sh`, `replit-deploy-security.sh`, `replit-deploy-ux-modals.sh`.

---

## 10. Variables de entorno

| Variable | Uso | Obligatoria en producción |
|---|---|---|
| `DATABASE_URL` | PostgreSQL (la inyecta Replit) | Sí |
| `SESSION_SECRET` | Firma de sesiones | Sí |
| `AUTH_ENCRYPTION_KEY` | Cifrado de credenciales guardadas (SMTP, SendGrid heredada, Google) | Recomendada (hoy falta) |
| `SECRET_BOX_KEY` | Cifrado de claves de emisión IVS | Recomendada (hoy falta) |
| `APP_BASE_URL` | Origen público para enlaces de correo y OAuth | Recomendada (hoy falta) |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | IVS, S3, ECS | Sí |
| `AWS_S3_BUCKET` | Bucket de contenido y marca | Sí |
| `AWS_ECS_CLUSTER`, `AWS_ECS_EMITTER_TASK`, `AWS_ECS_SUBNETS`, `AWS_ECS_SECURITY_GROUPS` | Emisor de eventos simulados | Sí (simulados) |
| `AWS_IVS_RECORDING_CONFIGURATION_ARN` | Grabación de canales | Opcional |
| `AWS_SES_*`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Alternativa de correo por SES | No |
| `ZOOM_*` | App propia Server-to-Server (alternativa al conector) | No |
| `CRON_SECRET` | Respaldo externo del planificador | Opcional |
| `SUPPORT_EMAIL`, `SALES_EMAIL`, `SUPPORT_HOURS`, `PRIVACY_EMAIL` | Textos del centro de ayuda y privacidad | Recomendadas |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PLATFORM_TIMEZONE`, `NEXT_PUBLIC_IVS_MAX_HEIGHT` | Cliente | Opcionales |
| `COMMUNICATIONS_SCHEDULER=off` | Desactiva el planificador interno | No |

---

## 11. Capacidad y rendimiento

- El video no pasa por la aplicación: Amazon IVS lo sirve por su CDN con calidad adaptativa; el reproductor se recupera solo de cortes de manifiesto y errores de decodificación.
- La carga en Replit la generan la entrada masiva a la sala y una conexión SSE por asistente. Con 3 máquinas de Autoscale la plataforma se dimensionó para cientos de asistentes concurrentes; para más de 500 se recomienda subir el máximo a 6 durante el evento. Script de prueba de carga: `scripts/sse-load.mjs`.
- Los límites de peticiones se guardan en memoria por máquina (`lib/rate-limit.ts`).
- El planificador interno depende de que haya al menos una máquina activa; el tráfico de los asistentes en el lobby lo garantiza en la práctica, y `/api/cron/communications` es el respaldo.

---

## 12. Mantenimiento y evolución recomendados

- Definir los secretos pendientes (sección 10) y volver a guardar las credenciales de correo tras crear `AUTH_ENCRYPTION_KEY`.
- Añadir una política de contenido (CSP) en modo report-only y luego aplicarla.
- Migrar el límite de peticiones a un almacén compartido si se opera con varias máquinas de forma habitual.
- Registrar los envíos manuales en `communication_deliveries` (requiere ampliar el enumerado `communication_type`).
- Importar automáticamente las grabaciones de IVS a la biblioteca.
- Cifrar el secreto MFA y evitar la reutilización de códigos dentro de su ventana.
- Mantener actualizadas las dependencias con una publicación de prueba previa.
