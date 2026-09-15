# Zoom: ajustes y permisos necesarios para Icaza Jammoul Live

Última revisión: 14 de septiembre de 2026.

La plataforma crea la reunión de Zoom al confirmar un evento **En vivo** o **Híbrido**, la conecta con el canal de Amazon IVS del evento y arranca o detiene la transmisión desde la pestaña **Transmisión** o desde la **Sala técnica**. Para que ese flujo funcione de punta a punta hacen falta tres cosas: ajustes en la cuenta de Zoom, permisos del conector y una licencia adecuada.

---

## A. Ajustes en la cuenta de Zoom

Ruta: **zoom.us → Configuración → pestaña Reunión**.

| Ajuste | Estado requerido | Para qué |
|---|---|---|
| **En la reunión (Avanzado) → Permitir la transmisión en vivo de reuniones** | **Activado** | Sin esto Zoom rechaza cualquier destino de transmisión |
| ↳ **Servicio de transmisión en vivo personalizado** | **Marcado** | Es el que recibe la URL RTMPS y la clave del canal de IVS |
| ↳ Facebook / YouTube / Workplace | Indiferente | No se usan |
| **Programar reunión → Permitir a los participantes unirse antes que el anfitrión** | Desactivado (recomendado) | La transmisión solo arranca con el anfitrión dentro |
| **Seguridad → Sala de espera** | A criterio del equipo | No afecta la transmisión; solo a quien entre a Zoom |
| **En la reunión (Básico) → Compartir pantalla** | Activado | Presentaciones durante la sesión |
| **Grabación → Grabación en la nube** | Opcional | La grabación del evento la hace IVS/S3, no Zoom |

Si un interruptor aparece con candado, lo bloqueó el administrador de la cuenta. Se activa desde **Administración → Configuración de la cuenta**, misma ruta.

> El conector de Zoom que usa la plataforma **no puede cambiar este ajuste por API** (le falta el permiso `user:update:settings`). Es un cambio manual que se hace una sola vez. El paso 1 del panel **Zoom → Amazon IVS** indica la ruta y tiene el botón **Volver a comprobar** para validarlo.

---

## B. Permisos (scopes) del conector de Zoom

Operaciones que hace la plataforma y el permiso que necesita cada una. La última columna es el estado verificado con el conector administrado de Replit el 14 de septiembre de 2026.

| Operación | Endpoint | Scope clásico | Scope granular | Conector Replit |
|---|---|---|---|---|
| Leer perfil | `GET /users/me` | `user:read` | `user:read:user` | ✅ tiene |
| Leer ajustes de la cuenta | `GET /users/me/settings` | `user:read` | `user:read:settings` | ✅ tiene (el panel muestra el estado real) |
| **Cambiar ajustes de la cuenta** | `PATCH /users/me/settings` | `user:write` | `user:update:settings` | ❌ **no tiene** |
| Crear reunión | `POST /users/me/meetings` | `meeting:write` | `meeting:write:meeting` | ✅ tiene |
| Actualizar reunión (reprogramar, título) | `PATCH /meetings/{id}` | `meeting:write` | `meeting:update:meeting` | ✅ tiene |
| Listar reuniones | `GET /users/me/meetings` | `meeting:read` | `meeting:read:list_meetings` | ✅ tiene |
| **Eliminar reunión** | `DELETE /meetings/{id}` | `meeting:write` | `meeting:delete:meeting` | ❌ no tiene¹ |
| Leer destino de transmisión | `GET /meetings/{id}/livestream` | `meeting:read` | `meeting:read:livestream` | ⏳ por confirmar en el ensayo |
| **Fijar destino de transmisión** | `PATCH /meetings/{id}/livestream` | `meeting:write` | `meeting:update:livestream` | ⏳ por confirmar |
| **Iniciar / detener transmisión** | `PATCH /meetings/{id}/livestream/status` | `meeting:write` | `meeting:update:livestream_status` | ⏳ por confirmar |

¹ Por eso, al cancelar un evento, la reunión no se borra: se renombra con el prefijo `[CANCELADO]` y se desvincula. Queda registrado en Auditoría como `zoom.meeting.cancel_marked`.

Los tres puntos "por confirmar" se validan en el primer ensayo con un evento nuevo. Si falta alguno, el panel muestra el mensaje exacto de Zoom con el scope que falta.

### Alternativa: app propia Server-to-Server OAuth

Si se quiere el 100 % por API (borrar reuniones y activar ajustes sin tocar Zoom a mano), se crea una app **Server-to-Server OAuth** en [marketplace.zoom.us](https://marketplace.zoom.us) con estos scopes:

```
user:read:user            user:read:settings        user:update:settings
meeting:read:meeting      meeting:read:list_meetings
meeting:write:meeting     meeting:update:meeting    meeting:delete:meeting
meeting:read:livestream   meeting:update:livestream meeting:update:livestream_status
```

(o, en nomenclatura clásica: `user:read`, `user:write`, `meeting:read`, `meeting:write`).

El código para usarla ya existe en el repositorio (`lib/zoom.ts`, variante local) y se activa con las variables `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID` y `ZOOM_CLIENT_SECRET` en los Secrets de Replit. Las credenciales las pega el administrador directamente en Replit; nunca se comparten por chat ni se guardan en el código.

---

## C. Licencia y anfitrión

- **Licencia**: la transmisión personalizada requiere un usuario **Licensed** (Pro, Business, Education o Enterprise). Con una cuenta Basic el ajuste no aparece.
- **El anfitrión es la cuenta conectada**: las reuniones se crean a nombre del usuario del conector. Quien inicie la reunión el día del evento debe entrar con esa misma cuenta o figurar como **anfitrión alternativo**; si otra persona la abre, "Iniciar transmisión desde Zoom" no puede actuar sobre ella.
- **Quién puede transmitir**: solo el anfitrión o un co-anfitrión. La API actúa en nombre del anfitrión.
- **Cliente Zoom actualizado** en el equipo del anfitrión: versiones antiguas no admiten el streaming personalizado iniciado por API.

---

## D. Lista de verificación antes de un evento En vivo

1. Ajuste **Permitir la transmisión en vivo → Servicio personalizado** activado (sección A).
2. Evento creado y **confirmado** en la plataforma: se crean la reunión y el canal, y la reunión queda apuntando al canal.
3. En **Transmisión → Zoom → Amazon IVS**, los tres pasos en ✓.
4. Ensayo 30 minutos antes: el anfitrión inicia la reunión en Zoom; en la **Sala técnica** se pulsa **Iniciar transmisión desde Zoom** y la señal aparece en 30 a 60 segundos, sin emisión pública.
5. A la hora del evento: mismo procedimiento; el estado pasa a **En vivo** y los inscritos reciben el aviso.
