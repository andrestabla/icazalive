# Recomendaciones para la administración y la entrega de un servicio óptimo

**Plataforma:** Icaza Jammoul Live · `https://liveicazajammoul.com`
**Versión del documento:** 18 de septiembre de 2026
**Destinatarios:** administradores de la plataforma y organizadores de eventos

Este documento reúne las prácticas que garantizan que cada evento salga bien: qué preparar antes, qué vigilar durante, qué cerrar después y cómo mantener sana la plataforma entre eventos. Está escrito para el equipo que opera el servicio, no para el desarrollador; la parte técnica está en el documento "Documentación técnica de la plataforma".

---

## 1. Principios de operación

1. **Todo evento tiene un dueño.** Cada evento debe tener al menos un organizador asignado en la pestaña Organizadores. Desde la revisión de seguridad de septiembre, un organizador solo ve y gestiona los eventos donde figura como organizador; el administrador ve todos.
2. **Nada se improvisa el día del evento.** La configuración, el contenido, las comunicaciones y la prueba técnica se cierran, como mínimo, 24 horas antes.
3. **El participante no distingue la tecnología.** Para el asistente todo evento es "en vivo": no se menciona si es simulado, híbrido ni qué proveedores lo sirven.
4. **Cada cambio queda registrado.** La Auditoría guarda quién hizo qué y cuándo. Ante cualquier duda, se consulta antes de suponer.
5. **Las credenciales no viajan por chat.** Claves de API, contraseñas y secretos se pegan directamente en Replit (Secrets) o en Integraciones; nunca en correos, mensajes ni documentos compartidos.

---

## 2. Roles y accesos

| Rol | Puede | No puede |
|---|---|---|
| **Administrador** | Todo: eventos de cualquier organizador, equipo, permisos, marca, integraciones, privacidad, auditoría, eliminar participantes y eventos | — |
| **Organizador** | Crear y gestionar sus eventos, invitar y escribir a sus participantes, moderar sus salas, ver analítica de sus eventos | Eliminar eventos o participantes, cambiar integraciones, gestionar el equipo (salvo permisos adicionales) |
| **Participante** | Registrarse, entrar a la sala con su enlace personal, gestionar su inscripción, dar retroalimentación | Acceder al panel |

**Recomendaciones**

- Mantener **dos administradores como máximo** y con MFA activado (Seguridad de la cuenta → segundo factor). El resto del equipo como organizadores.
- Revisar en **Permisos** que ningún organizador tenga `team.manage` salvo necesidad: ese permiso permite crear cuentas de administrador.
- Al retirar a alguien del equipo, usar **Desactivar** en Equipo: cierra sus sesiones al instante y conserva su historial en la auditoría.
- Los organizadores deben entrar con **Google (SSO)** cuando esté habilitado; reduce contraseñas débiles.

---

## 3. Calendario operativo de un evento

### 3.1 Al crear el evento (2 a 4 semanas antes)

- Elegir bien el **formato**: En vivo (Zoom → Amazon IVS), Simulado (video de la biblioteca emitido a la hora) o Híbrido (Zoom que cede al video). El formato no se cambia sin consecuencias después de confirmar: crea reuniones de Zoom y canales de video.
- Definir **fecha, hora y zona horaria** con cuidado. Todo lo que ve el participante (página, correos, calendario) sale de ahí. Un cambio de fecha reprograma automáticamente recordatorios y reunión de Zoom, pero conviene evitarlo.
- **Duración realista.** En eventos simulados la duración debe ser mayor o igual a la del video; el evento se completa solo al terminar el contenido.
- Sacar el evento de borrador con **Abrir registro** solo cuando la página pública esté revisada: a partir de ahí es visible y cualquiera con el enlace puede inscribirse.

### 3.2 Página de registro y comunicaciones (mínimo 1 semana antes)

- **Texto de presentación**, imagen de fondo y colores del evento en la pestaña Registro. Probar el enlace en un teléfono.
- **Campos del formulario**: pedir solo lo que se usará. Nombre y correo son fijos; empresa, cargo y teléfono se pueden hacer opcionales o quitar. Cada campo extra reduce la tasa de inscripción.
- **Compartir el enlace** con los botones de WhatsApp, LinkedIn, X e Instagram: la miniatura se genera sola. Si se cambia el título o el fondo después de compartir, WhatsApp puede seguir mostrando la miniatura antigua durante horas.
- Revisar las cinco plantillas en **Comunicaciones**: confirmación, recordatorio de 24 h, de 1 h, "ya estamos en vivo" y seguimiento posterior. Nunca borrar `{{access_link}}`.
- Definir el **momento del seguimiento posterior** (por defecto 1 hora después del fin) y el **enlace de Calendly** del organizador si se quiere agendar reuniones.
- Configurar el **mensaje de cierre** de la sala en Interacción (lo que ven los asistentes al terminar).
- Decidir qué **módulos de la sala** estarán activos: chat, preguntas, encuestas, recursos, reacciones. Menos módulos, menos moderación.
- Enviar un **registro de prueba** con un correo propio y comprobar: correo de confirmación con cabecera y pie de marca, botón "Entrar al evento", "Añadir al calendario" abre las opciones de Google, Outlook, Yahoo y .ics.

### 3.3 Contenido y transmisión (mínimo 48 horas antes)

**Simulado**
- Subir el video a **Contenidos** y esperar a que termine de procesarse. Asignarlo en Transmisión → "Elige el video que se emitirá".
- Comprobar en la Sala técnica que el emisor está "En espera · arranca a la hora del evento".
- Un ensayo con "Iniciar ahora (prueba)" solo en un evento de prueba: en el evento real pone la sala en vivo de inmediato para los inscritos.

**En vivo e híbrido (Zoom)**
- El anfitrión de Zoom debe ser la cuenta conectada en Integraciones. Quien inicie la reunión el día del evento debe entrar con esa cuenta o estar como anfitrión alternativo.
- En Transmisión → panel Zoom → Amazon IVS, los tres pasos en verde. Si el paso 3 no está, pulsar "Conectar con el canal".
- Ensayo real 30 minutos antes: reunión abierta en Zoom, "Iniciar transmisión desde Zoom", ver la señal en la Sala técnica. Este ensayo no es público.
- Marcar **Grabar la sesión** antes de confirmar el evento si se quiere la grabación en S3.

**Todos**
- Ejecutar **Revisión técnica** en la Sala técnica y resolver cualquier ✕.
- Cargar los **recursos** (enlaces, PDF) y preparar las **encuestas** con antelación; se publican en vivo con un clic.

### 3.4 El día del evento

| Momento | Acción | Quién |
|---|---|---|
| T-60 min | Sala técnica abierta. Comprobar emisor / señal de Zoom. Módulos de la sala activos según lo decidido. | Organizador técnico |
| T-30 min | Ensayo de señal (Zoom) o verificación de "En espera" (simulado). Moderador entra a la sala como participante de prueba. | Organizador técnico |
| T-15 min | Revisar cola de Comunicaciones: recordatorio de 1 h enviado, sin errores. Si hay "Con error", pulsar **Reintentar con error**. | Organizador |
| T-0 | Simulado: arranca solo. Zoom: "Iniciar transmisión desde Zoom" y luego **Iniciar el evento**. Verificar que la sala del participante muestra el video. | Organizador técnico |
| Durante | Moderar chat y preguntas. Publicar encuestas y recursos. Vigilar la línea de tiempo del contenido. Apagar un módulo si se desborda. | Moderador |
| Cierre | Simulado: se completa solo. Zoom: "Detener transmisión desde Zoom" y **Cerrar la sala**. Los asistentes ven el mensaje de cierre. | Organizador técnico |

**Reglas durante la emisión**
- No cambiar fecha, duración ni formato con el evento en vivo.
- No pulsar "Detener emisión" para "probar": corta la señal a todos.
- Si la señal cae en Zoom: verificar que la reunión sigue abierta, volver a pulsar "Iniciar transmisión desde Zoom"; la sala se recupera sola en 30 a 60 segundos.
- Si un participante no ve video: pedirle que recargue; si persiste, que use "Latencia estándar" no aplica al asistente, así que revisar su red y navegador (Chrome, Safari o Edge actualizados).
- Mantener un canal de contacto de soporte (el correo de soporte configurado) atendido durante todo el evento.

### 3.5 Después del evento (24 a 48 horas)

- Confirmar que el evento quedó **Completado** y que quienes no entraron figuran como "No asistió".
- Revisar la **Analítica** del evento: inscritos, asistentes, tiempo en sala, participación en chat y encuestas, retroalimentación.
- Comprobar que el **seguimiento posterior** salió (Comunicaciones → Enviados) y que el enlace de agendamiento funciona.
- Descargar la **grabación** del bucket si se marcó la opción, y subirla a Contenidos si se reutilizará.
- Exportar participantes (Excel) si el área comercial los necesita.
- Anotar incidencias y mejoras en un registro interno del equipo.

---

## 4. Comunicaciones por correo

- El proveedor activo es **SendGrid** (Integraciones → Correo saliente). El remitente `live@liveicazajammoul.com` está autenticado; no cambiar los registros DNS del dominio sin avisar.
- Antes de cada evento con más de 200 inscritos, comprobar en SendGrid la reputación del dominio y que no haya bloqueos.
- Si un correo queda **Con error**, leer el motivo: casi siempre es una dirección inválida o un rebote. Corregir el dato del participante y usar **Reintentar con error**.
- El **envío manual** desde Participantes sirve para avisos puntuales (cambio de hora, material extra). Usar plantilla del evento cuando exista; escribir mensaje nuevo solo para lo excepcional. Máximo 500 destinatarios por envío.
- Evitar más de tres correos por participante y evento: confirmación, un recordatorio y el seguimiento son suficientes en la mayoría de los casos.
- Nunca pegar enlaces personales de un participante en un mensaje masivo: cada persona recibe el suyo automáticamente con `{{access_link}}`.

---

## 5. Participantes y datos personales

- La plataforma cumple con un modelo de consentimiento explícito: cada inscripción guarda la versión de la política y los términos aceptados. **No modificar los textos legales** sin publicar una versión nueva desde Privacidad.
- Las **solicitudes de derechos** (acceso, rectificación, borrado) llegan al Centro de privacidad y solo el administrador las atiende. Plazo interno recomendado: 10 días hábiles.
- **Eliminar participante** (solo administrador) es definitivo. Para retirar a alguien de un evento, basta con cambiar su estado a Cancelado.
- Estados que cambian solos: Registrado → Confirmado (al invitar), Asistió (al entrar en vivo), No asistió (al completar), Cancelado (autogestión). Corregir a mano solo con evidencia.
- La exportación a Excel contiene datos personales: guardarla en carpetas con acceso restringido y borrarla cuando deje de usarse.

---

## 6. Mantenimiento de la plataforma

### Semanal
- Revisar **Auditoría** buscando accesos fallidos repetidos o acciones inesperadas.
- Revisar el saldo de **créditos de Replit**: si se agotan, la base de datos se apaga y el sitio deja de funcionar. Mantener la recarga automática activa con un tope conocido.
- Borrar eventos de prueba antiguos.

### Mensual
- Verificar que los secretos críticos existan en Replit: `AUTH_ENCRYPTION_KEY`, `SECRET_BOX_KEY`, `APP_BASE_URL`, `AWS_IVS_RECORDING_CONFIGURATION_ARN`, credenciales de AWS y SendGrid.
- Comprobar en AWS el consumo de IVS, ECS y S3 y limpiar canales o grabaciones que ya no se usen.
- Probar el flujo completo con un evento de prueba pequeño: registro, correo, sala, cierre.
- Revisar que las cuentas del equipo sigan siendo las correctas y desactivar las que ya no correspondan.

### Trimestral
- Repetir la revisión de seguridad (ver documento "seguridad-pentest") y aplicar las mejoras pendientes.
- Actualizar las dependencias del proyecto con una publicación de prueba antes de la real.
- Revisar la capacidad de Replit (máquinas máximas de Autoscale) frente al evento más grande previsto.

---

## 7. Capacidad y rendimiento

- Producción corre en **Replit Autoscale** (2 vCPU, 4 GiB por máquina, hasta 3 máquinas). El video **no** pasa por Replit: lo entrega Amazon IVS por su red global, así que 500 o 5.000 espectadores no cargan el servidor; lo que carga son las conexiones de chat y la entrada masiva al inicio.
- Para eventos con más de **500 inscritos**, subir temporalmente el máximo de máquinas a 6 en Publishing → Manage (Autoscale machine configuration) y devolverlo después. Solo se paga cuando escalan.
- Recomendar a los asistentes entrar **5 minutos antes** para repartir la carga de entrada.
- En redes débiles el reproductor baja la calidad solo; el chat se reconecta solo. No hace falta que el participante haga nada.
- Activar en Replit **Enable app uptime email notifications** para enterarse de caídas.

---

## 8. Publicación de cambios (para quien administre el código)

1. Nunca publicar durante un evento ni en la hora previa.
2. Si el cambio añade columnas a la base de datos, crearlas **antes** en las dos bases (Development y Production) desde la consola SQL; si el diálogo de publicación propone borrar (DROP) algo, cancelar.
3. Publicar con **Republish** y verificar en producción la página de inicio, el registro de un evento y la sala de un evento de prueba.
4. Conservar los scripts de despliegue del repositorio (`scripts/replit-deploy-*.sh`): aplican cambios anclados sin sobrescribir lo que el agente de Replit haya modificado.

---

## 9. Gestión de incidencias

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El sitio no carga / error de base de datos | Créditos de Replit agotados | Recargar créditos; la base vuelve sola en minutos |
| No llegan correos | Proveedor mal configurado o clave vencida | Integraciones → Correo saliente → Probar. Corregir y "Reintentar con error" |
| La sala muestra lobby con 0 minutos | El evento no pasó a En vivo | Iniciar el evento (o "Iniciar ahora" en simulado) |
| Señal de Zoom no aparece | Reunión no iniciada por la cuenta conectada o ajuste de Zoom apagado | Verificar anfitrión y panel Zoom → IVS; "Volver a comprobar" |
| Participante bloqueado por intentos | Límite de registro (3 por correo por hora) | Esperar o inscribirlo desde Participantes → Invitar |
| Organizador no ve un evento | No figura como organizador | Añadirlo en Organizadores del evento |
| Enlace de calendario "no válido" | Enlace personal caducado o inscripción cancelada | Reenviar confirmación desde Participantes → Enviar mensaje |

---

## 10. Contactos y responsables (completar)

| Función | Responsable | Contacto |
|---|---|---|
| Administrador de la plataforma | | |
| Responsable de eventos | | |
| Soporte a participantes durante eventos | | |
| Cuenta de Zoom (anfitrión) | | |
| Cuenta de AWS | | |
| Cuenta de Replit y facturación | | |
| Privacidad y datos personales | | |
