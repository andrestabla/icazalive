#!/usr/bin/env python3
"""Centro de ayuda: pasos nuevos de septiembre (compartir registro, fondo,
campos base, Calendly, reintentar con error, Zoom → IVS, módulos de la sala,
plantilla CSV). Idempotente: si ya están, no hace nada."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "lib/help-guides.ts"; s = p.read_text(encoding="utf-8")
if "registro-compartir" in s:
    print("OK help-guides.ts: pasos de septiembre ya presentes"); sys.exit(0)

def rep(old, new, label):
    global s
    if old not in s:
        print("ERROR ancla no encontrada:", label); sys.exit(1)
    s = s.replace(old, new, 1); print("OK", label)

# --- Registro: página pública con insignia EN VIVO -------------------------
rep('{ image: img("registro-publico"), caption: t("Página pública de registro.", "Public registration page.", "Page publique d’inscription.") },',
    '{ image: img("registro-publico-nuevo"), caption: t("Página pública de registro: siempre se presenta como evento en vivo.", "Public registration page: always presented as a live event.", "Page publique d’inscription : toujours présentée comme un événement en direct.") },',
    "registro: captura página pública")

# --- Registro: compartir + fondo (después del paso de Apariencia) ----------
old_apariencia = '''      step(
        t(
          "**Apariencia → Colores del evento** permite sobrescribir la marca global (color principal, de acento y fondo) solo para este evento; **Volver a la marca global** deshace el cambio.",
          "**Appearance → Event colors** lets you override the global brand (primary, accent and background colors) for this event only; **Back to global brand** undoes the change.",
          "**Apparence → Couleurs de l’événement** permet de remplacer la marque globale (couleur principale, d’accent et de fond) pour cet événement uniquement ; **Revenir à la marque globale** annule le changement.",
        ),
      ),'''
new_apariencia = old_apariencia + '''
      step(
        t(
          "**Compartir**: junto al enlace hay botones para **WhatsApp**, **LinkedIn**, **X**, **Instagram** y **Copiar enlace**. Al pegar el enlace en cualquiera de esas redes aparece una miniatura automática con el título del evento, la fecha y los colores de tu marca; no hay que subir ninguna imagen.",
          "**Share**: next to the link there are buttons for **WhatsApp**, **LinkedIn**, **X**, **Instagram** and **Copy link**. When the link is pasted in any of those networks an automatic thumbnail appears with the event title, date and your brand colors; no image upload needed.",
          "**Partager** : à côté du lien se trouvent des boutons **WhatsApp**, **LinkedIn**, **X**, **Instagram** et **Copier le lien**. Lorsque le lien est collé sur l’un de ces réseaux, une miniature automatique apparaît avec le titre de l’événement, la date et vos couleurs ; aucune image à téléverser.",
        ),
        {
          image: img("registro-compartir"),
          caption: t("Botones para compartir el enlace de registro.", "Buttons to share the registration link.", "Boutons de partage du lien d’inscription."),
          tip: t(
            "WhatsApp y LinkedIn guardan la miniatura la primera vez que ven un enlace. Si cambias el título o la imagen de fondo después de compartir, la vista previa puede tardar en actualizarse.",
            "WhatsApp and LinkedIn cache the thumbnail the first time they see a link. If you change the title or background image after sharing, the preview may take a while to refresh.",
            "WhatsApp et LinkedIn mettent la miniature en cache la première fois qu’ils voient un lien. Si vous changez le titre ou l’image de fond après le partage, l’aperçu peut mettre du temps à se rafraîchir.",
          ),
        },
      ),
      step(
        t(
          "**Fondo de la página de registro**: sube una imagen con **Subir imagen** (JPG o PNG de hasta 3 MB, ideal 1600×1200 px) o pega una dirección y pulsa **Usar URL**. Se muestra detrás del título y la fecha, con los colores del evento encima para que el texto siga legible. **Quitar fondo** vuelve al degradado de la marca.",
          "**Registration page background**: upload an image with **Upload image** (JPG or PNG up to 3 MB, ideally 1600×1200 px) or paste an address and click **Use URL**. It appears behind the title and date, tinted with the event colors so the text stays legible. **Remove background** returns to the brand gradient.",
          "**Fond de la page d’inscription** : téléversez une image avec **Téléverser une image** (JPG ou PNG jusqu’à 3 Mo, idéalement 1600×1200 px) ou collez une adresse et cliquez sur **Utiliser l’URL**. Elle apparaît derrière le titre et la date, teintée des couleurs de l’événement pour garder le texte lisible. **Retirer le fond** revient au dégradé de la marque.",
        ),
        { image: img("registro-fondo"), caption: t("Panel de imagen de fondo.", "Background image panel.", "Panneau d’image de fond.") },
      ),'''
rep(old_apariencia, new_apariencia, "registro: compartir y fondo")

# --- Registro: campos base editables ---------------------------------------
old_campos = '''      step(
        t(
          "**Formulario → Campos de inscripción**: nombre, correo, empresa, cargo y teléfono ya vienen incluidos. Pulsa **＋ Agregar campo** para añadir preguntas propias (texto o lista de opciones) y usa **Hacer obligatorio**, **Activar** o **Eliminar** en cada una. Las respuestas aparecen en la ficha del participante y en la exportación.",
          "**Form → Registration fields**: name, email, company, job title and phone are included. Click **＋ Add field** to add your own questions (text or option list) and use **Make required**, **Enable** or **Delete** on each one. Answers appear in the participant profile and in the export.",
          "**Formulaire → Champs d’inscription** : nom, e-mail, entreprise, poste et téléphone sont inclus. Cliquez sur **＋ Ajouter un champ** pour ajouter vos propres questions (texte ou liste d’options) et utilisez **Rendre obligatoire**, **Activer** ou **Supprimer** sur chacune. Les réponses apparaissent dans la fiche du participant et dans l’export.",
        ),
      ),'''
new_campos = '''      step(
        t(
          "**Formulario → Campos de inscripción**: **Nombre completo** y **Correo electrónico** son fijos y siempre obligatorios. **Empresa**, **Cargo** y **Teléfono** se pueden renombrar, alternar con **Hacer obligatorio** / **Hacer opcional**, o retirar con **Quitar del formulario** (y **Volver a incluir** para recuperarlos). Pulsa **＋ Agregar campo** para añadir preguntas propias (texto o lista de opciones). Las respuestas aparecen en la ficha del participante y en la exportación.",
          "**Form → Registration fields**: **Full name** and **Email** are fixed and always required. **Company**, **Job title** and **Phone** can be renamed, toggled with **Make required** / **Make optional**, or removed with **Remove from form** (and **Include again** to bring them back). Click **＋ Add field** to add your own questions (text or option list). Answers appear in the participant profile and in the export.",
          "**Formulaire → Champs d’inscription** : **Nom complet** et **E-mail** sont fixes et toujours obligatoires. **Entreprise**, **Poste** et **Téléphone** peuvent être renommés, basculés avec **Rendre obligatoire** / **Rendre facultatif**, ou retirés avec **Retirer du formulaire** (et **Réintégrer** pour les récupérer). Cliquez sur **＋ Ajouter un champ** pour vos propres questions (texte ou liste d’options). Les réponses apparaissent dans la fiche du participant et dans l’export.",
        ),
        {
          image: img("registro-campos-base"),
          caption: t("Campos base y campos propios del formulario.", "Base fields and custom fields of the form.", "Champs de base et champs personnalisés du formulaire."),
          warning: t(
            "El asistente nunca ve el formato del evento (en vivo, simulado o híbrido): la página de registro, los correos y la sala siempre lo presentan como un evento en vivo.",
            "The attendee never sees the event format (live, simulated or hybrid): the registration page, the emails and the room always present it as a live event.",
            "Le participant ne voit jamais le format de l’événement (direct, simulé ou hybride) : la page d’inscription, les e-mails et la salle le présentent toujours comme un événement en direct.",
          ),
        },
      ),'''
rep(old_campos, new_campos, "registro: campos base")

# --- Comunicaciones: contadores + reintentar -------------------------------
old_cola = '''          "Arriba verás cuatro contadores: **En cola** (listos para enviar), **Programados** (según la fecha del evento), **Enviados** y **Con error**. **Procesar cola ahora** fuerza el envío inmediato de lo que esté en cola.",
          "At the top you see four counters: **Queued** (ready to send), **Scheduled** (based on the event date), **Sent** and **Failed**. **Process queue now** forces the immediate sending of whatever is queued.",
          "En haut, quatre compteurs : **En file** (prêts à l’envoi), **Programmés** (selon la date de l’événement), **Envoyés** et **En erreur**. **Traiter la file maintenant** force l’envoi immédiat de ce qui est en attente.",
        ),
        { image: img("evento-comunicaciones"), caption: t("Automatizaciones y editor de plantillas.", "Automations and template editor.", "Automatisations et éditeur de modèles.") },
      ),'''
new_cola = '''          "Arriba verás cuatro contadores: **En cola** (listos para enviar), **Programados** (según la fecha del evento), **Enviados** y **Con error**. **Procesar cola ahora** fuerza el envío inmediato de lo que esté en cola. Si **Con error** es mayor que cero aparece **Reintentar con error**: vuelve a poner en cola esos mensajes y los envía de nuevo, sin volver a inscribir a nadie.",
          "At the top you see four counters: **Queued** (ready to send), **Scheduled** (based on the event date), **Sent** and **Failed**. **Process queue now** forces the immediate sending of whatever is queued. When **Failed** is above zero, **Retry failed** appears: it re-queues those messages and sends them again, without re-registering anyone.",
          "En haut, quatre compteurs : **En file** (prêts à l’envoi), **Programmés** (selon la date de l’événement), **Envoyés** et **En erreur**. **Traiter la file maintenant** force l’envoi immédiat de ce qui est en attente. Si **En erreur** est supérieur à zéro, **Réessayer les erreurs** apparaît : il remet ces messages en file et les renvoie, sans réinscrire personne.",
        ),
        {
          image: img("comunicaciones-cola"),
          caption: t("Contadores de la cola y botones de envío.", "Queue counters and sending buttons.", "Compteurs de la file et boutons d’envoi."),
          warning: t(
            "Los correos salen por el proveedor activo en **Integraciones → Correo saliente** (SendGrid). Si un mensaje queda **Con error** por un problema del proveedor (por ejemplo, remitente o destinatario no verificado), corrige primero la integración y después pulsa **Reintentar con error**.",
            "Emails go out through the provider active in **Integrations → Outgoing email** (SendGrid). If a message ends up **Failed** because of a provider issue (for example an unverified sender or recipient), fix the integration first and then click **Retry failed**.",
            "Les e-mails partent via le fournisseur actif dans **Intégrations → E-mail sortant** (SendGrid). Si un message finit **En erreur** à cause du fournisseur (expéditeur ou destinataire non vérifié, par exemple), corrigez d’abord l’intégration puis cliquez sur **Réessayer les erreurs**.",
          ),
        },
      ),'''
rep(old_cola, new_cola, "comunicaciones: cola y reintento")

# --- Comunicaciones: Calendly (después del paso del editor) ----------------
old_editor_warn = '''          warning: t(
            "Nunca borres `{{access_link}}` de la confirmación ni de los recordatorios: es la única forma que tiene el asistente de entrar a la sala.",
            "Never remove `{{access_link}}` from the confirmation or reminders: it is the attendee's only way into the room.",
            "Ne supprimez jamais `{{access_link}}` de la confirmation ni des rappels : c’est le seul moyen pour le participant d’entrer dans la salle.",
          ),
        },
      ),'''
new_editor_warn = old_editor_warn + '''
      step(
        t(
          "Abre **Seguimiento posterior** y verás el bloque **Agendamiento · Calendly**. Pega tu enlace de Calendly (o de cualquier agenda en línea) en **Tu enlace de Calendly** y pulsa **Guardar mi enlace**: queda asociado a tu usuario, así que sirve para todos tus eventos. El correo de seguimiento incluye entonces el botón **Agendar una reunión** que lleva al participante a tu agenda; en la plantilla corresponde a la variable `{{schedule_link}}`.",
          "Open **Follow-up** and you will see the **Scheduling · Calendly** block. Paste your Calendly link (or any online scheduling link) in **Your Calendly link** and click **Save my link**: it is tied to your user, so it works for all your events. The follow-up email then includes the **Schedule a meeting** button that takes the participant to your calendar; in the template it is the `{{schedule_link}}` variable.",
          "Ouvrez **Suivi** et vous verrez le bloc **Prise de rendez-vous · Calendly**. Collez votre lien Calendly (ou tout autre agenda en ligne) dans **Votre lien Calendly** et cliquez sur **Enregistrer mon lien** : il est associé à votre utilisateur et vaut pour tous vos événements. L’e-mail de suivi inclut alors le bouton **Planifier une réunion** qui mène le participant à votre agenda ; dans le modèle c’est la variable `{{schedule_link}}`.",
        ),
        { image: img("comunicaciones-agendar"), caption: t("Enlace de agendamiento del organizador.", "Organizer scheduling link.", "Lien de prise de rendez-vous de l’organisateur.") },
      ),'''
rep(old_editor_warn, new_editor_warn, "comunicaciones: Calendly")

# --- Transmisión: panel Zoom → Amazon IVS y biblioteca ----------------------
old_trans = '''        { image: img("evento-transmision"), caption: t("Pestaña Transmisión de un evento En vivo.", "Streaming tab of a Live event.", "Onglet Diffusion d’un événement En direct.") },
      ),'''
new_trans = old_trans + '''
      step(
        t(
          "En eventos **En vivo** e **Híbridos** el panel **Zoom → Amazon IVS** hace el enlace completo desde la plataforma. Paso **1**: la cuenta de Zoom debe tener activado *Permitir la transmisión en vivo → Servicio personalizado*; es un ajuste manual que se hace una sola vez con **Abrir ajustes de Zoom ↗** y se valida con **Volver a comprobar**. Paso **2**: la reunión de Zoom se crea sola al confirmar el evento. Paso **3**: **Conectar con el canal** apunta esa reunión al canal de video del evento.",
          "In **Live** and **Hybrid** events the **Zoom → Amazon IVS** panel makes the whole link from the platform. Step **1**: the Zoom account must have *Allow livestreaming → Custom service* enabled; it is a one-time manual setting done with **Open Zoom settings ↗** and validated with **Check again**. Step **2**: the Zoom meeting is created automatically when the event is confirmed. Step **3**: **Connect to channel** points that meeting to the event's video channel.",
          "Pour les événements **En direct** et **Hybrides**, le panneau **Zoom → Amazon IVS** fait tout le lien depuis la plateforme. Étape **1** : le compte Zoom doit avoir *Autoriser la diffusion en direct → Service personnalisé* activé ; réglage manuel unique via **Ouvrir les paramètres Zoom ↗**, validé avec **Vérifier à nouveau**. Étape **2** : la réunion Zoom est créée automatiquement à la confirmation. Étape **3** : **Connecter au canal** pointe cette réunion vers le canal vidéo de l’événement.",
        ),
        {
          image: img("transmision-zoom-ivs"),
          caption: t("Panel Zoom → Amazon IVS con los tres pasos.", "Zoom → Amazon IVS panel with the three steps.", "Panneau Zoom → Amazon IVS avec les trois étapes."),
          tip: t(
            "El día del evento el anfitrión inicia la reunión en Zoom con la misma cuenta conectada; luego, en este panel o en la Sala técnica, pulsa **Iniciar transmisión desde Zoom**. La señal aparece en 30 a 60 segundos. **Detener transmisión desde Zoom** corta la emisión sin cerrar la reunión.",
            "On event day the host starts the meeting in Zoom with the same connected account; then, in this panel or in the Technical room, click **Start streaming from Zoom**. The signal appears within 30 to 60 seconds. **Stop streaming from Zoom** ends the broadcast without closing the meeting.",
            "Le jour J, l’hôte démarre la réunion dans Zoom avec le même compte connecté ; puis, dans ce panneau ou dans la Salle technique, cliquez sur **Démarrer la diffusion depuis Zoom**. Le signal apparaît en 30 à 60 secondes. **Arrêter la diffusion depuis Zoom** coupe la diffusion sans fermer la réunion.",
          ),
        },
      ),
      step(
        t(
          "En eventos **Simulados** lo más importante es el bloque destacado **Elige el video que se emitirá**: selecciona ahí el video de la biblioteca que se emitirá como si fuera en vivo. Sin contenido seleccionado el evento no puede pasar a En vivo.",
          "In **Simulated** events the key piece is the highlighted **Choose the video to broadcast** block: select there the library video that will be broadcast as if it were live. Without selected content the event cannot go live.",
          "Pour les événements **Simulés**, l’essentiel est le bloc mis en avant **Choisissez la vidéo à diffuser** : sélectionnez-y la vidéo de la bibliothèque qui sera diffusée comme en direct. Sans contenu sélectionné, l’événement ne peut pas passer En direct.",
        ),
        { image: img("transmision-biblioteca"), caption: t("Selección del contenido de la biblioteca.", "Library content selection.", "Sélection du contenu de la bibliothèque.") },
      ),'''
rep(old_trans, new_trans, "transmisión: Zoom → IVS y biblioteca")

# --- Interacción: módulos de la sala ----------------------------------------
old_inter = '''        { image: img("evento-interaccion"), caption: t("Pestaña Interacción completa.", "Full Interaction tab.", "Onglet Interaction complet.") },
      ),'''
new_inter = old_inter + '''
      step(
        t(
          "**Módulos de la sala** decide qué verán los participantes: **Chat en vivo**, **Preguntas**, **Encuestas**, **Recursos** y **Reacciones**. Apaga con el interruptor lo que este evento no necesite. Puedes cambiarlo también durante la transmisión: la sala de todos los asistentes se actualiza al instante, sin recargar.",
          "**Room modules** decide what participants will see: **Live chat**, **Questions**, **Polls**, **Resources** and **Reactions**. Switch off whatever this event does not need. You can also change it during the broadcast: every attendee's room updates instantly, without reloading.",
          "**Modules de la salle** décide de ce que verront les participants : **Chat en direct**, **Questions**, **Sondages**, **Ressources** et **Réactions**. Désactivez ce dont cet événement n’a pas besoin. Vous pouvez aussi le changer pendant la diffusion : la salle de tous les participants se met à jour instantanément, sans rechargement.",
        ),
        { image: img("interaccion-modulos"), caption: t("Interruptores de los módulos de la sala.", "Room module switches.", "Interrupteurs des modules de la salle.") },
      ),'''
rep(old_inter, new_inter, "interacción: módulos")

# --- Palabras clave ---------------------------------------------------------
rep('"interacción", "chat", "encuesta", "preguntas"],',
    '"interacción", "chat", "encuesta", "preguntas", "compartir", "whatsapp", "linkedin", "miniatura", "fondo", "campos", "calendly", "agendar", "reintentar", "módulos", "reacciones"],',
    "keywords es")
rep('"interaction", "chat", "poll", "questions"],',
    '"interaction", "chat", "poll", "questions", "share", "whatsapp", "linkedin", "thumbnail", "background", "fields", "calendly", "schedule", "retry", "modules", "reactions"],',
    "keywords en")
rep('"interaction", "chat", "sondage", "questions"],',
    '"interaction", "chat", "sondage", "questions", "partager", "whatsapp", "linkedin", "miniature", "fond", "champs", "calendly", "rendez-vous", "réessayer", "modules", "réactions"],',
    "keywords fr")

p.write_text(s, encoding="utf-8")
print("LISTO help-guides.ts")
