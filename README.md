# Icaza Live

Plataforma local para gestionar eventos virtuales e híbridos. El proyecto prepara integraciones con Zoom
y servicios de AWS sin acoplar los datos de negocio a esos proveedores.

## Contexto y estado del proyecto

Corte funcional: **29 de julio de 2026**.

La aplicación se desarrolla primero de manera local y se diseñó para migrar a
Replit o a otra infraestructura PostgreSQL sin cambiar el modelo de negocio. La
matriz técnica contiene 109 requisitos; la auditoría vigente registra:

- 31 requisitos cumplidos.
- 54 requisitos parciales.
- 12 requisitos pendientes.
- 12 requisitos que requieren despliegue o pruebas de infraestructura.
- Índice ponderado actual: 53,7%.

Los estados parciales no equivalen a cumplimiento contractual final. En
particular, Zoom, Amazon IVS/S3, entrega de email, SSO y MFA continúan
preconfigurados o simulados hasta conectar proveedores y secretos reales.

El informe detallado está en
[`auditoria_cumplimiento_Icaza_Live.xlsx`](../outputs/019f9f54-0e93-7431-afc1-179755609f13/auditoria_cumplimiento_Icaza_Live.xlsx).
La primera hoja conserva intacta la matriz original; las hojas **Auditoría 109**
y **Resumen auditoría** contienen evidencia, brechas y métricas calculadas.

## Arquitectura

```text
Next.js (App Router)
├── UI administrativa y páginas públicas
├── Route Handlers /api
├── Servicios de dominio en /lib
└── Drizzle ORM
    ├── PGlite local por defecto
    └── PostgreSQL externo mediante DATABASE_URL
```

Los datos de eventos, registros, comunicaciones, interacción, auditoría,
privacidad y configuración pública se almacenan en PostgreSQL/PGlite. Los
secretos de proveedores permanecen exclusivamente en variables de entorno.

Las migraciones `drizzle/0000` a `drizzle/0024` son la fuente de verdad del
esquema. Las más recientes incorporan: votos de preguntas (`question_votes`),
vigencia de contraseñas (`users.password_changed_at`), plazo de autogestión por
evento (`0016`); organizadores por evento (`event_organizers`) y URL de
redirección post-registro (`0017`); respuestas de feedback
(`event_feedback_responses`), configuración de encuesta por evento y zona
horaria por usuario (`0018`); colores de marca por evento (`0019`); video
pregrabado y redirección final para eventos simulados (`0020`); plantillas
reutilizables de eventos (`0021`); segundo factor TOTP y códigos de respaldo (`0022`); reintentos del worker de correo (`0023`); cadena de integridad de auditoría (`0024`).

Importante: PGlite es una base embebida en el proceso. No ejecutes migraciones,
seeds o scripts que escriban en la base mientras `npm run dev` está activo;
detén el servidor, ejecuta el script y vuelve a iniciarlo.

## Funcionalidad disponible localmente

- Gestión de eventos, sesiones, estados, detección de conflictos y duplicación
  con ajuste de fechas. Las transiciones de estado siguen una matriz estricta
  (completado es terminal; cancelado solo se recupera como borrador) y las
  acciones sensibles piden confirmación.
- Organizadores por evento: propietario y coorganizadores, asignación desde el
  detalle del evento, transferencia de propiedad y permisos por evento (los
  organizadores solo modifican los eventos donde están asignados).
- Redirección opcional a una página informativa del organizador después de
  completar el registro.
- Registro público con campos personalizados de texto, área de texto, selección
  y consentimiento.
- Enlaces personales con acceso a sala, autogestión de datos,
  cancelación/reactivación y descarga de calendario ICS. Cada evento define un
  plazo de autogestión (hasta el inicio o con cierre anticipado configurable);
  vencido el plazo, el enlace personal no permite editar ni cancelar.
- Participantes con búsqueda, filtro por evento y por estado, paginación,
  cambio de estado, exportación CSV/XLSX con selección de columnas, invitación
  individual e importación CSV de hasta 500 filas.
- Colores de marca por evento (principal, acento y fondo) que sobrescriben la
  marca global en las páginas públicas del evento.
- Eventos simulados con video pregrabado: carga de MP4 (hasta 1 GB, validado y
  guardado en `~/.icaza-live/media`, fuera de OneDrive), reproducción
  automática a la hora del evento con reloj compartido (corrección cuando la
  desviación supera 2 s), finalización automática del evento y redirección
  opcional de los asistentes al terminar.
- Informe del evento imprimible o guardable como PDF desde la pestaña
  Analítica; el equipo admite eliminación definitiva de cuentas con
  salvaguardas (nunca la propia, nunca el último administrador, y se bloquea
  si la cuenta creó eventos).
- Comunicaciones configurables con variables renderizadas, confirmaciones en
  cola y recordatorios programados.
- Plantillas reutilizables: cualquier evento puede guardarse como plantilla
  (formato, duración, campos de registro, comunicaciones, marca y políticas) y
  reutilizarse al crear eventos nuevos.
- La sala recibe la actividad por push (Server-Sent Events) con el sondeo como
  respaldo; foco visible y movimiento reducido respetados en toda la interfaz.
- Sala y estudio con chat público, canal privado, Q&A con votación de
  preguntas (un voto por participante, retirable), encuestas, reacciones,
  recursos y moderación de participantes.
- Seguridad de cuentas: contraseñas de mínimo 12 caracteres con mayúscula,
  minúscula, número y símbolo; vigencia de 180 días con avisos automáticos y
  cambio autoservicio desde el perfil (cierra las demás sesiones abiertas).
- Verificación en dos pasos (TOTP) sin dependencias externas: activación desde
  el perfil con app autenticadora, paso adicional en el login y 8 códigos de
  respaldo de un solo uso.
- Analítica global y por evento sobre registros, asistencia, interacción,
  comunicaciones y preparación técnica.
- Equipo, marca, integraciones, auditoría, privacidad/derechos de datos y Centro
  de ayuda multilingüe.

El worker/planificador de comunicaciones ya procesa la cola: confirmaciones al
instante y recordatorios al vencer su hora, con reintentos (backoff, máx. 3) y
estados por entrega. En local entrega al buzón de vista previa; para envío real
basta definir `RESEND_API_KEY` y `EMAIL_FROM`. Se ejecuta al consultar la
pestaña Comunicaciones o con el botón "Procesar cola ahora"; en producción se
recomienda además un cron que llame al endpoint de proceso. Quedan pendientes
rebotes y seguimiento de entregabilidad.

## Desarrollo local

Requiere Node.js 22 o superior.

```bash
npm install
npm run db:setup
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`. Si no se define
`DATABASE_URL`, utiliza PostgreSQL embebido mediante PGlite y guarda los datos
en `~/.icaza-live/pglite`.

Acceso administrativo inicial:

- correo: `andres@icazalive.local`
- contraseña: `IcazaLive2026!`

La contraseña puede cambiarse con `LOCAL_ADMIN_PASSWORD` al ejecutar los datos
iniciales.

## Base de datos

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Para Replit o producción, define `DATABASE_URL` con una instancia PostgreSQL.
El mismo esquema y las mismas migraciones se utilizan en ambos entornos.

Antes de migrar a Replit:

1. Crear la base PostgreSQL administrada.
2. Configurar `DATABASE_URL` y los secretos descritos en `.env.example`.
3. Ejecutar `npm run db:migrate` y luego `npm run db:seed` únicamente si se
   requiere información inicial.
4. Validar `/api/health`, login, registro, acceso personal y auditoría.
5. Conectar los proveedores externos de forma gradual, sin trasladar secretos
   desde formularios o datos locales.

## Integraciones

Las configuraciones de eventos, sesiones y estados técnicos se guardan en
PostgreSQL. Las credenciales privadas de Zoom y AWS se leen únicamente desde
variables de entorno; nunca se almacenan en los formularios ni en la base de
datos.

Consulta `.env.example` para conocer las variables previstas. En modo local,
las revisiones técnicas validan la configuración sin crear reuniones, canales
o transmisiones reales.

La pantalla de Integraciones incluye asistentes para:

- Zoom OAuth: cuenta, callback y checklist de secretos.
- Amazon IVS + S3: región, canal, bucket y credenciales IAM.
- SSO/MFA: OIDC o SAML, dominio corporativo y política de segundo factor.

Los asistentes guardan exclusivamente metadatos públicos y políticas. SSO,
MFA y las conexiones externas permanecen en estado de preconfiguración hasta
que se añadan los secretos y se implemente la activación con el proveedor real.

## Registro e invitaciones

Cada registro genera un token aleatorio cuyo hash se guarda en la base. Ese
token autoriza la sala, la autogestión y el calendario sin exponer credenciales
administrativas.

El asistente de participantes acepta altas individuales o CSV con encabezados
en español e inglés. Valida formato de correo, duplicados del lote, registros
existentes, capacidad del evento y un máximo de 500 filas. Las invitaciones
crean registros confirmados y preparan las comunicaciones habilitadas con
enlaces personales.

Las variables disponibles para las plantillas incluyen participante, evento,
fecha, acceso a sala, autogestión y calendario. El cuerpo final renderizado se
conserva en `communication_deliveries`.

## Auditoría

El módulo `/audit`, disponible solo para administradores, registra accesos,
intentos fallidos y cambios críticos de eventos, sesiones, participantes,
comunicaciones, interacción, streaming, integraciones, SSO/MFA, marca y equipo.
La bitácora conserva actor, fecha, recurso, resultado, IP y contexto técnico,
permite aplicar filtros y exportar la vista actual a CSV.

La bitácora de aplicación no sustituye todavía los logs de infraestructura ni
un almacén append-only. Producción deberá añadir retención de dos años, copias,
restauración, alertas y exportación a un SIEM.

## Centro de ayuda

`/help` es público y reúne guías en español, inglés y francés para primeros
pasos, eventos, cuenta, integraciones, videos, comunidad y soporte. La búsqueda
se ejecuta localmente sobre contenido versionado y no envía las consultas a
servicios externos.

El formulario de soporte solicita únicamente datos mínimos, ofrece contexto
opcional del evento, evita solicitudes duplicadas durante 24 horas y conserva
cada solicitud durante 180 días. Los envíos se almacenan en PostgreSQL y se
registran en la bitácora de auditoría. Configura `SUPPORT_EMAIL`, `SALES_EMAIL`
y `SUPPORT_HOURS` antes de publicar el proyecto.

## Privacidad y derechos de datos

`/privacy` publica la Política de privacidad y los Términos de uso vigentes,
además de un formulario para solicitudes de acceso, corrección, eliminación,
portabilidad y restricción. Cada solicitud recibe una fecha límite de 30 días
y debe verificar identidad antes de entregar o eliminar información.

`/privacy/manage` está reservado a administradores. Permite publicar nuevas
versiones de los documentos, consultar evidencia de consentimiento y gestionar
solicitudes. Las inscripciones guardan las versiones aceptadas, fecha, contexto
técnico y una huella SHA-256 del correo. Las exportaciones verificadas se
generan en JSON y la eliminación requiere confirmación explícita del correo.

## Respaldos e integridad

Con el servidor detenido:

```bash
npm run db:backup
npm run db:restore -- ~/.icaza-live/backups/backup-<fecha>
```

El respaldo copia la base PGlite y los videos a `~/.icaza-live/backups`. La
bitácora de auditoría usa una cadena de hashes SHA-256 (cada entrada firma la
anterior); el botón "Verificar integridad" de la pantalla de Auditoría detecta
cualquier registro alterado o eliminado de la cadena.

## Verificación

```bash
npm run db:migrate
npm run lint
npm run build
```

El último recorrido local validó invitación individual, importación CSV con
duplicado y correo inválido, creación de accesos personales, autogestión,
contenido renderizado de confirmaciones y recordatorios, migraciones, lint,
TypeScript y build de producción.

## Próximas prioridades

1. Activar OAuth de Zoom y aprovisionamiento real de reuniones/webinars.
2. Conectar Amazon IVS/S3 y validar streaming/recording end-to-end.
3. Implementar proveedor y worker de correo con entregabilidad y reintentos.
4. Activar OIDC/SAML y MFA, incluyendo recuperación y códigos de respaldo.
5. Desplegar PostgreSQL/servicios en Replit y ejecutar pruebas de carga,
   disponibilidad, recuperación y 5.000 asistentes.
