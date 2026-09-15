import type { HelpArticle, HelpGuideSection, HelpGuideStep, LocalizedText } from "@/lib/help-content";

// Guías paso a paso del organizador, con capturas reales de la plataforma
// (public/help/*.jpg). Cada paso nombra los botones y pestañas tal como
// aparecen en pantalla para que el organizador pueda seguirlos sin ayuda.

const t = (es: string, en: string, fr: string): LocalizedText => ({ es, en, fr });

const step = (
  text: LocalizedText,
  extra: Partial<Omit<HelpGuideStep, "text">> = {},
): HelpGuideStep => ({ text, ...extra });

const img = (name: string) => `/help/${name}.jpg`;

// ---------------------------------------------------------------------------
// Guía 1: Gestión de eventos
// ---------------------------------------------------------------------------

const manageEventsSections: HelpGuideSection[] = [
  {
    id: "crear",
    title: t("Crear un evento", "Create an event", "Créer un événement"),
    intro: t(
      "Todo evento nace como borrador. Solo necesitas formato, nombre, fecha y duración; el resto se configura después desde la pantalla del evento.",
      "Every event starts as a draft. You only need the format, name, date and duration; everything else is configured later from the event screen.",
      "Chaque événement commence comme brouillon. Il suffit du format, du nom, de la date et de la durée ; le reste se configure ensuite depuis l’écran de l’événement.",
    ),
    steps: [
      step(
        t(
          "Desde **Resumen** o **Eventos**, pulsa el botón morado **＋ Crear evento** (arriba a la derecha).",
          "From **Overview** or **Events**, click the purple **＋ Create event** button (top right).",
          "Depuis **Résumé** ou **Événements**, cliquez sur le bouton violet **＋ Créer un événement** (en haut à droite).",
        ),
        { image: img("resumen"), caption: t("Panel Resumen con el botón Crear evento.", "Overview panel with the Create event button.", "Panneau Résumé avec le bouton Créer un événement.") },
      ),
      step(
        t(
          "Elige el formato. **En vivo**: Zoom + interacción en tiempo real, la señal de Zoom se distribuye por Amazon IVS. **Simulado**: un video pregrabado de la Biblioteca de contenidos se emite a la hora programada como si fuera en vivo. **Híbrido**: combina ambos (público presencial y remoto).",
          "Choose the format. **Live**: Zoom + real-time interaction, the Zoom signal is distributed through Amazon IVS. **Simulated**: a pre-recorded video from the Content library is broadcast at the scheduled time as if it were live. **Hybrid**: combines both (on-site and remote audience).",
          "Choisissez le format. **En direct** : Zoom + interaction en temps réel, le signal Zoom est diffusé via Amazon IVS. **Simulé** : une vidéo préenregistrée de la Bibliothèque de contenus est diffusée à l’heure prévue comme un direct. **Hybride** : combine les deux (public sur place et à distance).",
        ),
        {
          image: img("crear-formato"),
          caption: t("Selector de formato del nuevo evento.", "Format selector for the new event.", "Sélecteur de format du nouvel événement."),
          warning: t(
            "El formato no se puede cambiar después. Si te equivocas, elimina el borrador y crea otro.",
            "The format cannot be changed later. If you pick the wrong one, delete the draft and create a new event.",
            "Le format ne peut pas être modifié ensuite. En cas d’erreur, supprimez le brouillon et créez-en un autre.",
          ),
        },
      ),
      step(
        t(
          "Completa **Información principal**: elige una **Plantilla** si guardaste una de un evento anterior (copia agenda, comunicaciones y encuestas), escribe el **Nombre del evento**, la **Fecha y hora** (siempre en hora de Miami, America/New_York) y la **Duración**. Pulsa **Crear borrador**.",
          "Fill in **Main information**: pick a **Template** if you saved one from a previous event (it copies agenda, communications and polls), type the **Event name**, the **Date and time** (always Miami time, America/New_York) and the **Duration**. Click **Create draft**.",
          "Renseignez **Informations principales** : choisissez un **Modèle** si vous en avez enregistré un depuis un événement précédent (il copie l’agenda, les communications et les sondages), saisissez le **Nom de l’événement**, la **Date et l’heure** (toujours à l’heure de Miami, America/New_York) et la **Durée**. Cliquez sur **Créer le brouillon**.",
        ),
        {
          image: img("crear-informacion"),
          caption: t("Formulario de información principal.", "Main information form.", "Formulaire des informations principales."),
          tip: t(
            "Si ya existe otro evento a la misma hora, la plataforma te avisa del conflicto antes de crear el borrador.",
            "If another event already exists at the same time, the platform warns you about the conflict before creating the draft.",
            "Si un autre événement existe déjà à la même heure, la plateforme vous signale le conflit avant de créer le brouillon.",
          ),
        },
      ),
    ],
  },
  {
    id: "lista",
    title: t("Encontrar y organizar tus eventos", "Find and organize your events", "Retrouver et organiser vos événements"),
    steps: [
      step(
        t(
          "Entra a **Eventos** en el menú lateral. Cada tarjeta muestra la fecha, el formato (En vivo, Simulado, Híbrido), el estado del evento, la hora, la duración, la capacidad y el estado del registro (Abierto o Cerrado).",
          "Open **Events** in the side menu. Each card shows the date, format (Live, Simulated, Hybrid), event status, time, duration, capacity and registration status (Open or Closed).",
          "Ouvrez **Événements** dans le menu latéral. Chaque carte affiche la date, le format (En direct, Simulé, Hybride), le statut de l’événement, l’heure, la durée, la capacité et l’état des inscriptions (Ouvert ou Fermé).",
        ),
        { image: img("eventos-lista"), caption: t("Lista de eventos con buscador y filtros.", "Event list with search and filters.", "Liste des événements avec recherche et filtres.") },
      ),
      step(
        t(
          "Usa **Buscar por nombre del evento** para filtrar por texto y el selector **Estado** para ver solo borradores, eventos con registro abierto, en preparación, en vivo, completados o cancelados. El contador de la derecha indica cuántos eventos cumplen el filtro.",
          "Use **Search by event name** to filter by text and the **Status** selector to show only drafts, events with open registration, preparing, live, completed or cancelled. The counter on the right shows how many events match.",
          "Utilisez **Rechercher par nom d’événement** pour filtrer par texte et le sélecteur **Statut** pour n’afficher que les brouillons, inscriptions ouvertes, en préparation, en direct, terminés ou annulés. Le compteur à droite indique combien d’événements correspondent.",
        ),
      ),
      step(
        t(
          "Cambia entre **Lista** y **Calendario**. El calendario ubica cada evento en su día; usa las flechas o **Hoy** para moverte entre meses y haz clic en un evento para abrirlo.",
          "Switch between **List** and **Calendar**. The calendar places each event on its day; use the arrows or **Today** to move between months and click an event to open it.",
          "Basculez entre **Liste** et **Calendrier**. Le calendrier place chaque événement à sa date ; utilisez les flèches ou **Aujourd’hui** pour changer de mois et cliquez sur un événement pour l’ouvrir.",
        ),
        { image: img("eventos-calendario"), caption: t("Vista de calendario mensual.", "Monthly calendar view.", "Vue calendrier mensuelle.") },
      ),
    ],
  },
  {
    id: "acciones",
    title: t("Menú Acciones: gestionar, duplicar y eliminar", "Actions menu: manage, duplicate and delete", "Menu Actions : gérer, dupliquer et supprimer"),
    steps: [
      step(
        t(
          "En cada tarjeta, pulsa **Acciones ▾**. Se despliegan tres opciones: **Duplicar**, **Eliminar** (solo administradores) y **Gestionar →** (abre la pantalla completa del evento).",
          "On each card, click **Actions ▾**. Three options appear: **Duplicate**, **Delete** (administrators only) and **Manage →** (opens the full event screen).",
          "Sur chaque carte, cliquez sur **Actions ▾**. Trois options apparaissent : **Dupliquer**, **Supprimer** (administrateurs uniquement) et **Gérer →** (ouvre l’écran complet de l’événement).",
        ),
        { image: img("eventos-acciones"), caption: t("Menú Acciones desplegado.", "Actions menu open.", "Menu Actions ouvert.") },
      ),
      step(
        t(
          "**Duplicar** crea un nuevo borrador copiando agenda, comunicaciones, encuestas, recursos y configuración técnica. Los participantes **no** se copian. Ajusta el **Nombre del nuevo evento** y la **Nueva fecha y hora** y pulsa **Duplicar como borrador**.",
          "**Duplicate** creates a new draft copying agenda, communications, polls, resources and technical configuration. Participants are **not** copied. Adjust the **New event name** and the **New date and time** and click **Duplicate as draft**.",
          "**Dupliquer** crée un nouveau brouillon en copiant l’agenda, les communications, les sondages, les ressources et la configuration technique. Les participants ne sont **pas** copiés. Ajustez le **Nom du nouvel événement** et la **Nouvelle date et heure** puis cliquez sur **Dupliquer comme brouillon**.",
        ),
        { image: img("eventos-duplicar"), caption: t("Ventana de duplicación.", "Duplicate dialog.", "Fenêtre de duplication.") },
      ),
      step(
        t(
          "**Eliminar** borra de forma definitiva sesiones, inscripciones, comunicaciones, chat, preguntas, encuestas y recursos; si hay reunión de Zoom, se marca como cancelada. Escribe **ELIMINAR** en el campo y pulsa **Eliminar definitivamente**. La acción queda registrada en **Auditoría** con el título, la fecha y el número de inscritos del evento borrado.",
          "**Delete** permanently removes sessions, registrations, communications, chat, questions, polls and resources; if there is a Zoom meeting, it is marked as cancelled. Type **ELIMINAR** in the field and click **Delete permanently**. The action is recorded in **Audit** with the title, date and number of registrants of the deleted event.",
          "**Supprimer** efface définitivement sessions, inscriptions, communications, chat, questions, sondages et ressources ; s’il existe une réunion Zoom, elle est marquée comme annulée. Saisissez **ELIMINAR** dans le champ et cliquez sur **Supprimer définitivement**. L’action est consignée dans **Audit** avec le titre, la date et le nombre d’inscrits de l’événement supprimé.",
        ),
        {
          image: img("eventos-eliminar"),
          caption: t("Confirmación de eliminación.", "Delete confirmation.", "Confirmation de suppression."),
          warning: t(
            "No se puede eliminar un evento mientras está **En vivo**. Detén la emisión y complétalo o cancélalo primero.",
            "An event cannot be deleted while it is **Live**. Stop the broadcast and complete or cancel it first.",
            "Un événement ne peut pas être supprimé tant qu’il est **En direct**. Arrêtez la diffusion puis terminez-le ou annulez-le d’abord.",
          ),
        },
      ),
    ],
  },
  {
    id: "estados",
    title: t("La pantalla del evento y sus estados", "The event screen and its statuses", "L’écran de l’événement et ses statuts"),
    intro: t(
      "Al abrir un evento verás su cabecera con el estado actual y seis pestañas: Resumen, Registro, Comunicaciones, Transmisión, Interacción y Analítica.",
      "When you open an event you see its header with the current status and six tabs: Overview, Registration, Communications, Streaming, Interaction and Analytics.",
      "En ouvrant un événement vous voyez son en-tête avec le statut actuel et six onglets : Résumé, Inscription, Communications, Diffusion, Interaction et Analyses.",
    ),
    steps: [
      step(
        t(
          "La pestaña **Resumen** muestra la **Agenda** (sesiones), la lista **Preparación del evento** con los pasos esenciales (Información principal, Página de registro, Transmisión) y, a la derecha, los contadores de **Registrados** y **Registro**, el estado de **Transmisión** (Zoom y Amazon IVS) y los **Organizadores**.",
          "The **Overview** tab shows the **Agenda** (sessions), the **Event preparation** checklist with the essential steps (Main information, Registration page, Streaming) and, on the right, the **Registered** and **Registration** counters, the **Streaming** status (Zoom and Amazon IVS) and the **Organizers**.",
          "L’onglet **Résumé** affiche l’**Agenda** (sessions), la liste **Préparation de l’événement** avec les étapes essentielles (Informations principales, Page d’inscription, Diffusion) et, à droite, les compteurs **Inscrits** et **Inscription**, l’état de la **Diffusion** (Zoom et Amazon IVS) et les **Organisateurs**.",
        ),
        { image: img("evento-resumen"), caption: t("Pestaña Resumen del evento.", "Event Overview tab.", "Onglet Résumé de l’événement.") },
      ),
      step(
        t(
          "El evento avanza por estados. **Borrador** → **Registro abierto** (la página pública acepta inscripciones) → **En preparación** (registro cerrado, ajustes finales) → **En vivo** → **Completado**. Desde cualquier estado previo puedes pasar a **Cancelado**, y un evento cancelado puede volver a Borrador. Completado es definitivo.",
          "The event moves through statuses. **Draft** → **Registration open** (the public page accepts sign-ups) → **Preparing** (registration closed, final adjustments) → **Live** → **Completed**. From any earlier status you can move to **Cancelled**, and a cancelled event can go back to Draft. Completed is final.",
          "L’événement passe par des statuts. **Brouillon** → **Inscriptions ouvertes** (la page publique accepte les inscriptions) → **En préparation** (inscriptions fermées, derniers réglages) → **En direct** → **Terminé**. Depuis tout statut antérieur vous pouvez passer à **Annulé**, et un événement annulé peut revenir en Brouillon. Terminé est définitif.",
        ),
      ),
      step(
        t(
          "Para cambiar de estado usa el selector **Estado** de la cabecera o el botón principal de al lado (por ejemplo **Cerrar registro** o **Iniciar el evento**). Los cambios importantes piden confirmación. Al pasar de Borrador a Registro abierto la plataforma crea automáticamente la reunión de Zoom y el canal de Amazon IVS de los eventos En vivo e Híbridos.",
          "To change status use the **Status** selector in the header or the main button next to it (for example **Close registration** or **Start event**). Important changes ask for confirmation. When moving from Draft to Registration open, the platform automatically creates the Zoom meeting and the Amazon IVS channel for Live and Hybrid events.",
          "Pour changer de statut, utilisez le sélecteur **Statut** de l’en-tête ou le bouton principal à côté (par exemple **Fermer les inscriptions** ou **Démarrer l’événement**). Les changements importants demandent confirmation. En passant de Brouillon à Inscriptions ouvertes, la plateforme crée automatiquement la réunion Zoom et le canal Amazon IVS des événements En direct et Hybrides.",
        ),
      ),
      step(
        t(
          "**Guardar como plantilla** (cabecera) conserva la configuración de este evento para reutilizarla al crear otros: aparecerá en el selector **Plantilla** del formulario de creación.",
          "**Save as template** (header) keeps this event's configuration so you can reuse it when creating others: it will appear in the **Template** selector of the creation form.",
          "**Enregistrer comme modèle** (en-tête) conserve la configuration de cet événement pour la réutiliser : elle apparaîtra dans le sélecteur **Modèle** du formulaire de création.",
        ),
      ),
    ],
  },
  {
    id: "agenda",
    title: t("Agenda y sesiones", "Agenda and sessions", "Agenda et sessions"),
    steps: [
      step(
        t(
          "En **Resumen → Agenda** pulsa **＋ Añadir sesión**. Indica **Nombre de la sesión**, **Inicio** y **Finalización**; el horario debe quedar dentro del inicio y final del evento. La primera sesión es la **Principal** y es la que se transmite en la sala.",
          "In **Overview → Agenda** click **＋ Add session**. Enter the **Session name**, **Start** and **End**; the schedule must fall within the event start and end. The first session is the **Main** one and is the one streamed in the room.",
          "Dans **Résumé → Agenda**, cliquez sur **＋ Ajouter une session**. Indiquez le **Nom de la session**, le **Début** et la **Fin** ; l’horaire doit rester dans les limites de l’événement. La première session est la **Principale** et c’est elle qui est diffusée dans la salle.",
        ),
        {
          image: img("evento-sesion"),
          caption: t("Ventana Añadir a la agenda.", "Add to agenda dialog.", "Fenêtre Ajouter à l’agenda."),
          tip: t(
            "Los controles de fecha usan la hora de tu dispositivo, pero el evento se guarda en la zona America/New_York. Revisa la hora convertida antes de guardar.",
            "Date controls use your device time, but the event is stored in the America/New_York time zone. Check the converted time before saving.",
            "Les contrôles de date utilisent l’heure de votre appareil, mais l’événement est enregistré dans le fuseau America/New_York. Vérifiez l’heure convertie avant d’enregistrer.",
          ),
        },
      ),
      step(
        t(
          "Cada sesión tiene un botón **Editar** para cambiar nombre y horario, y una etiqueta con su flujo técnico (por ejemplo **Zoom + IVS**). Si cambias la fecha del evento, la reunión de Zoom se reprograma sola.",
          "Each session has an **Edit** button to change its name and schedule, and a label with its technical flow (for example **Zoom + IVS**). If you change the event date, the Zoom meeting is rescheduled automatically.",
          "Chaque session possède un bouton **Modifier** pour changer le nom et l’horaire, ainsi qu’une étiquette avec son flux technique (par exemple **Zoom + IVS**). Si vous changez la date de l’événement, la réunion Zoom est reprogrammée automatiquement.",
        ),
      ),
    ],
  },
  {
    id: "registro",
    title: t("Pestaña Registro: página pública y formulario", "Registration tab: public page and form", "Onglet Inscription : page publique et formulaire"),
    steps: [
      step(
        t(
          "En **Registro** verás el estado de la **Página pública** y el enlace `/register/nombre-del-evento`. Pulsa **Abrir página ↗** para verla como la verá un asistente y copia el enlace para difundirlo por correo, redes o tu web.",
          "In **Registration** you see the **Public page** status and the `/register/event-name` link. Click **Open page ↗** to see it as an attendee will, and copy the link to share it by email, social media or your website.",
          "Dans **Inscription** vous voyez l’état de la **Page publique** et le lien `/register/nom-de-l-evenement`. Cliquez sur **Ouvrir la page ↗** pour la voir comme un participant et copiez le lien pour le diffuser par e-mail, réseaux sociaux ou votre site.",
        ),
        { image: img("evento-registro"), caption: t("Pestaña Registro completa.", "Full Registration tab.", "Onglet Inscription complet.") },
      ),
      step(
        t(
          "Así se ve la página pública: el asistente completa nombre, correo, empresa, cargo y teléfono, acepta la política de privacidad y los términos, y pulsa **Confirmar mi registro**. Recibe de inmediato el correo de confirmación con su **enlace personal de acceso**.",
          "This is the public page: the attendee fills in name, email, company, job title and phone, accepts the privacy policy and terms, and clicks **Confirm my registration**. They immediately receive the confirmation email with their **personal access link**.",
          "Voici la page publique : le participant renseigne nom, e-mail, entreprise, poste et téléphone, accepte la politique de confidentialité et les conditions, puis clique sur **Confirmer mon inscription**. Il reçoit immédiatement l’e-mail de confirmation avec son **lien d’accès personnel**.",
        ),
        { image: img("registro-publico-nuevo"), caption: t("Página pública de registro: siempre se presenta como evento en vivo.", "Public registration page: always presented as a live event.", "Page publique d’inscription : toujours présentée comme un événement en direct.") },
      ),
      step(
        t(
          "**Cerrar inscripciones** detiene nuevos registros sin cambiar el estado del evento (útil cuando se llena el cupo). El **Plazo de autogestión del asistente** define hasta cuándo un inscrito puede editar o cancelar su registro desde su enlace personal. La **Redirección después del registro** envía al asistente a una página tuya tras confirmar.",
          "**Close sign-ups** stops new registrations without changing the event status (useful when capacity is reached). The **Attendee self-service deadline** defines until when a registrant can edit or cancel their registration from their personal link. **Redirect after registration** sends the attendee to a page of yours after confirming.",
          "**Fermer les inscriptions** stoppe les nouvelles inscriptions sans changer le statut de l’événement (utile quand la capacité est atteinte). Le **Délai d’autogestion du participant** définit jusqu’à quand un inscrit peut modifier ou annuler son inscription depuis son lien personnel. La **Redirection après inscription** envoie le participant vers une de vos pages après confirmation.",
        ),
      ),
      step(
        t(
          "**Apariencia → Colores del evento** permite sobrescribir la marca global (color principal, de acento y fondo) solo para este evento; **Volver a la marca global** deshace el cambio.",
          "**Appearance → Event colors** lets you override the global brand (primary, accent and background colors) for this event only; **Back to global brand** undoes the change.",
          "**Apparence → Couleurs de l’événement** permet de remplacer la marque globale (couleur principale, d’accent et de fond) pour cet événement uniquement ; **Revenir à la marque globale** annule le changement.",
        ),
      ),
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
      ),
      step(
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
      ),
      step(
        t(
          "El bloque **Inscritos en este evento** lista los últimos registros con su estado; **Ver todos** abre la lista completa con buscador por nombre, correo o empresa.",
          "The **Registered for this event** block lists the latest sign-ups with their status; **View all** opens the full list with a search by name, email or company.",
          "Le bloc **Inscrits à cet événement** liste les dernières inscriptions avec leur statut ; **Tout afficher** ouvre la liste complète avec une recherche par nom, e-mail ou entreprise.",
        ),
        { image: img("evento-inscritos"), caption: t("Lista completa de inscritos del evento.", "Full list of event registrants.", "Liste complète des inscrits de l’événement.") },
      ),
    ],
  },
  {
    id: "comunicaciones",
    title: t("Pestaña Comunicaciones: correos automáticos", "Communications tab: automatic emails", "Onglet Communications : e-mails automatiques"),
    steps: [
      step(
        t(
          "Arriba verás cuatro contadores: **En cola** (listos para enviar), **Programados** (según la fecha del evento), **Enviados** y **Con error**. **Procesar cola ahora** fuerza el envío inmediato de lo que esté en cola. Si **Con error** es mayor que cero aparece **Reintentar con error**: vuelve a poner en cola esos mensajes y los envía de nuevo, sin volver a inscribir a nadie.",
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
      ),
      step(
        t(
          "En **Automatizaciones → Secuencia del participante** activa o pausa con el interruptor cada mensaje: **Confirmación de registro** (inmediata), **Recordatorio de 24 horas**, **Recordatorio de 1 hora** y **Seguimiento posterior** (1 hora después del evento). Además, al iniciar el evento se envía un aviso de “estamos en vivo”.",
          "In **Automations → Participant sequence** enable or pause each message with the switch: **Registration confirmation** (immediate), **24-hour reminder**, **1-hour reminder** and **Follow-up** (1 hour after the event). In addition, a “we are live” notice is sent when the event starts.",
          "Dans **Automatisations → Séquence du participant**, activez ou mettez en pause chaque message avec l’interrupteur : **Confirmation d’inscription** (immédiate), **Rappel 24 heures**, **Rappel 1 heure** et **Suivi** (1 heure après l’événement). De plus, un avis « nous sommes en direct » est envoyé au démarrage.",
        ),
      ),
      step(
        t(
          "Haz clic en un mensaje para abrirlo en **Editor y vista previa**. Edita el **Asunto** y el **Mensaje** usando las variables: `{{participant_name}}`, `{{event_title}}`, `{{event_date}}`, `{{access_link}}` (enlace personal a la sala), `{{manage_link}}` (editar o cancelar inscripción) y `{{calendar_link}}`. La **Vista previa para el participante** muestra el resultado con datos reales. Pulsa **Guardar plantilla**.",
          "Click a message to open it in **Editor and preview**. Edit the **Subject** and **Message** using the variables: `{{participant_name}}`, `{{event_title}}`, `{{event_date}}`, `{{access_link}}` (personal room link), `{{manage_link}}` (edit or cancel registration) and `{{calendar_link}}`. The **Participant preview** shows the result with real data. Click **Save template**.",
          "Cliquez sur un message pour l’ouvrir dans **Éditeur et aperçu**. Modifiez l’**Objet** et le **Message** avec les variables : `{{participant_name}}`, `{{event_title}}`, `{{event_date}}`, `{{access_link}}` (lien personnel vers la salle), `{{manage_link}}` (modifier ou annuler l’inscription) et `{{calendar_link}}`. L’**Aperçu pour le participant** montre le résultat avec des données réelles. Cliquez sur **Enregistrer le modèle**.",
        ),
        {
          warning: t(
            "Nunca borres `{{access_link}}` de la confirmación ni de los recordatorios: es la única forma que tiene el asistente de entrar a la sala.",
            "Never remove `{{access_link}}` from the confirmation or reminders: it is the attendee's only way into the room.",
            "Ne supprimez jamais `{{access_link}}` de la confirmation ni des rappels : c’est le seul moyen pour le participant d’entrer dans la salle.",
          ),
        },
      ),
      step(
        t(
          "Abre **Seguimiento posterior** y verás el bloque **Agendamiento · Calendly**. Pega tu enlace de Calendly (o de cualquier agenda en línea) en **Tu enlace de Calendly** y pulsa **Guardar mi enlace**: queda asociado a tu usuario, así que sirve para todos tus eventos. El correo de seguimiento incluye entonces el botón **Agendar una reunión** que lleva al participante a tu agenda; en la plantilla corresponde a la variable `{{schedule_link}}`.",
          "Open **Follow-up** and you will see the **Scheduling · Calendly** block. Paste your Calendly link (or any online scheduling link) in **Your Calendly link** and click **Save my link**: it is tied to your user, so it works for all your events. The follow-up email then includes the **Schedule a meeting** button that takes the participant to your calendar; in the template it is the `{{schedule_link}}` variable.",
          "Ouvrez **Suivi** et vous verrez le bloc **Prise de rendez-vous · Calendly**. Collez votre lien Calendly (ou tout autre agenda en ligne) dans **Votre lien Calendly** et cliquez sur **Enregistrer mon lien** : il est associé à votre utilisateur et vaut pour tous vos événements. L’e-mail de suivi inclut alors le bouton **Planifier une réunion** qui mène le participant à votre agenda ; dans le modèle c’est la variable `{{schedule_link}}`.",
        ),
        { image: img("comunicaciones-agendar"), caption: t("Enlace de agendamiento del organizador.", "Organizer scheduling link.", "Lien de prise de rendez-vous de l’organisateur.") },
      ),
      step(
        t(
          "En el mismo mensaje, el bloque **Momento de envío** define cuándo sale el seguimiento: escribe la cantidad, elige **minutos** u **horas** y pulsa **Guardar momento**. Se cuenta desde que **termina** el evento (por ejemplo, 2 horas después). Los envíos ya programados se mueven solos al nuevo momento.",
          "In the same message, the **Send time** block defines when the follow-up goes out: type the amount, choose **minutes** or **hours** and click **Save time**. It counts from the moment the event **ends** (for example, 2 hours later). Already scheduled deliveries move automatically to the new time.",
          "Dans le même message, le bloc **Moment d’envoi** définit quand part le suivi : saisissez la quantité, choisissez **minutes** ou **heures** et cliquez sur **Enregistrer le moment**. Il se compte à partir de la **fin** de l’événement (par exemple 2 heures après). Les envois déjà programmés se déplacent automatiquement.",
        ),
      ),
      step(
        t(
          "El botón **Añadir al calendario** de los correos abre una página con el evento ya cargado para **Google Calendar**, **Outlook.com**, **Outlook empresarial (Microsoft 365)**, **Yahoo Calendar** y un archivo **.ics** para Apple Calendar u Outlook de escritorio. El asistente elige su calendario y el evento queda guardado con su enlace personal de acceso.",
          "The **Add to calendar** button in the emails opens a page with the event preloaded for **Google Calendar**, **Outlook.com**, **Outlook for business (Microsoft 365)**, **Yahoo Calendar** and an **.ics** file for Apple Calendar or desktop Outlook. The attendee picks their calendar and the event is saved with their personal access link.",
          "Le bouton **Ajouter au calendrier** des e-mails ouvre une page avec l’événement préchargé pour **Google Calendar**, **Outlook.com**, **Outlook professionnel (Microsoft 365)**, **Yahoo Calendar** et un fichier **.ics** pour Apple Calendar ou Outlook de bureau. Le participant choisit son agenda et l’événement est enregistré avec son lien d’accès personnel.",
        ),
      ),
    ],
  },
  {
    id: "transmision",
    title: t("Pestaña Transmisión y sala técnica", "Streaming tab and technical room", "Onglet Diffusion et salle technique"),
    steps: [
      step(
        t(
          "**Estado técnico** resume cuánto de la configuración está lista. Los botones **Datos de emisión** (URL del servidor y clave del canal de IVS, por si usas un codificador externo), **Ejecutar revisión técnica** (valida horario, fuente de video y distribución) y **Abrir sala técnica** están siempre a mano.",
          "**Technical status** summarizes how much of the configuration is ready. The buttons **Broadcast details** (server URL and IVS channel key, in case you use an external encoder), **Run technical check** (validates schedule, video source and distribution) and **Open technical room** are always at hand.",
          "**État technique** résume la part de configuration prête. Les boutons **Données de diffusion** (URL du serveur et clé du canal IVS, si vous utilisez un encodeur externe), **Lancer la vérification technique** (valide horaire, source vidéo et distribution) et **Ouvrir la salle technique** sont toujours accessibles.",
        ),
        { image: img("evento-transmision"), caption: t("Pestaña Transmisión de un evento En vivo.", "Streaming tab of a Live event.", "Onglet Diffusion d’un événement En direct.") },
      ),
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
      ),
      step(
        t(
          "En eventos En vivo, el panel **Zoom → Amazon IVS** muestra tres pasos: (1) Zoom permite la transmisión personalizada, con el botón **Habilitar en Zoom** si falta; (2) reunión y canal creados (ocurre solo al confirmar el evento); (3) la reunión apunta al canal, con **Conectar con el canal** para rehacerlo. Cuando los tres están en ✓, el anfitrión inicia la reunión en Zoom y tú pulsas **Iniciar transmisión desde Zoom**: la señal llega a la sala en 30 a 60 segundos. **Detener transmisión desde Zoom** la corta.",
          "For Live events, the **Zoom → Amazon IVS** panel shows three steps: (1) Zoom allows custom live streaming, with the **Enable in Zoom** button if missing; (2) meeting and channel created (happens automatically when the event is confirmed); (3) the meeting points at the channel, with **Connect to channel** to redo it. When all three are ✓, the host starts the meeting in Zoom and you click **Start streaming from Zoom**: the signal reaches the room in 30 to 60 seconds. **Stop streaming from Zoom** cuts it.",
          "Pour les événements En direct, le panneau **Zoom → Amazon IVS** affiche trois étapes : (1) Zoom autorise la diffusion personnalisée, avec le bouton **Activer dans Zoom** si nécessaire ; (2) réunion et canal créés (automatique à la confirmation de l’événement) ; (3) la réunion pointe vers le canal, avec **Connecter au canal** pour recommencer. Quand les trois sont ✓, l’hôte démarre la réunion dans Zoom et vous cliquez sur **Démarrer la diffusion depuis Zoom** : le signal arrive dans la salle en 30 à 60 secondes. **Arrêter la diffusion depuis Zoom** la coupe.",
        ),
      ),
      step(
        t(
          "En **Configuración → Sesión principal** eliges el **Flujo de transmisión** (Zoom → Amazon IVS, Solo Zoom, Entrada directa a IVS o Simulado), la **Latencia** (baja o estándar) y si se debe **Grabar la sesión**. Pulsa **Guardar configuración**. La **Lista técnica** de la derecha marca en verde lo que ya está resuelto.",
          "In **Configuration → Main session** choose the **Streaming flow** (Zoom → Amazon IVS, Zoom only, Direct IVS input or Simulated), the **Latency** (low or standard) and whether to **Record the session**. Click **Save configuration**. The **Technical checklist** on the right marks in green what is already resolved.",
          "Dans **Configuration → Session principale**, choisissez le **Flux de diffusion** (Zoom → Amazon IVS, Zoom seul, Entrée directe IVS ou Simulé), la **Latence** (faible ou standard) et si la session doit être **Enregistrée**. Cliquez sur **Enregistrer la configuration**. La **Liste technique** à droite marque en vert ce qui est déjà réglé.",
        ),
      ),
      step(
        t(
          "**Abrir sala técnica** muestra la señal exactamente como la verá el participante, sin emitir al público ni notificar a nadie. En eventos Simulados, **Iniciar prueba técnica** arranca el emisor con el video del evento; en eventos En vivo usa el panel Zoom → Amazon IVS. **Ver como participante ↗** abre la sala real en modo vista previa. A la hora programada la automatización reinicia el contenido desde el principio, pone el evento **En vivo** y avisa a los inscritos.",
          "**Open technical room** shows the signal exactly as the participant will see it, without broadcasting to the public or notifying anyone. For Simulated events, **Start technical test** launches the emitter with the event video; for Live events use the Zoom → Amazon IVS panel. **View as participant ↗** opens the real room in preview mode. At the scheduled time the automation restarts the content from the beginning, sets the event **Live** and notifies registrants.",
          "**Ouvrir la salle technique** affiche le signal exactement comme le verra le participant, sans diffuser au public ni notifier personne. Pour les événements Simulés, **Démarrer le test technique** lance l’émetteur avec la vidéo de l’événement ; pour les événements En direct, utilisez le panneau Zoom → Amazon IVS. **Voir comme participant ↗** ouvre la vraie salle en mode aperçu. À l’heure prévue, l’automatisation relance le contenu depuis le début, passe l’événement **En direct** et prévient les inscrits.",
        ),
        {
          image: img("sala-tecnica"),
          caption: t("Sala técnica con el panel Zoom → Amazon IVS.", "Technical room with the Zoom → Amazon IVS panel.", "Salle technique avec le panneau Zoom → Amazon IVS."),
          tip: t(
            "Haz la prueba técnica al menos 30 minutos antes. Si la señal no aparece, revisa primero que el anfitrión haya iniciado la reunión en Zoom.",
            "Run the technical test at least 30 minutes ahead. If the signal does not appear, first check that the host has started the meeting in Zoom.",
            "Faites le test technique au moins 30 minutes avant. Si le signal n’apparaît pas, vérifiez d’abord que l’hôte a démarré la réunion dans Zoom.",
          ),
        },
      ),
    ],
  },
  {
    id: "interaccion",
    title: t("Pestaña Interacción: moderar en vivo", "Interaction tab: moderating live", "Onglet Interaction : modérer en direct"),
    steps: [
      step(
        t(
          "Los contadores superiores muestran preguntas pendientes, encuestas abiertas, respuestas registradas, mensajes públicos y reacciones rápidas. Todo lo que ocurre en la sala se refleja aquí en tiempo real.",
          "The top counters show pending questions, open polls, recorded answers, public messages and quick reactions. Everything that happens in the room is reflected here in real time.",
          "Les compteurs du haut affichent les questions en attente, sondages ouverts, réponses enregistrées, messages publics et réactions rapides. Tout ce qui se passe dans la salle se reflète ici en temps réel.",
        ),
        { image: img("evento-interaccion"), caption: t("Pestaña Interacción completa.", "Full Interaction tab.", "Onglet Interaction complet.") },
      ),
      step(
        t(
          "**Módulos de la sala** decide qué verán los participantes: **Chat en vivo**, **Preguntas**, **Encuestas**, **Recursos** y **Reacciones**. Apaga con el interruptor lo que este evento no necesite. Puedes cambiarlo también durante la transmisión: la sala de todos los asistentes se actualiza al instante, sin recargar.",
          "**Room modules** decide what participants will see: **Live chat**, **Questions**, **Polls**, **Resources** and **Reactions**. Switch off whatever this event does not need. You can also change it during the broadcast: every attendee's room updates instantly, without reloading.",
          "**Modules de la salle** décide de ce que verront les participants : **Chat en direct**, **Questions**, **Sondages**, **Ressources** et **Réactions**. Désactivez ce dont cet événement n’a pas besoin. Vous pouvez aussi le changer pendant la diffusion : la salle de tous les participants se met à jour instantanément, sans rechargement.",
        ),
        { image: img("interaccion-modulos"), caption: t("Interruptores de los módulos de la sala.", "Room module switches.", "Interrupteurs des modules de la salle.") },
      ),
      step(
        t(
          "**Preguntas y respuestas → Cola de moderación**: cada pregunta muestra autor, hora y votos. Usa **✓ Marcar respondida** cuando el ponente la conteste, **Descartar** para ocultarla y **Reabrir** si hace falta.",
          "**Q&A → Moderation queue**: each question shows author, time and votes. Use **✓ Mark answered** when the speaker answers it, **Dismiss** to hide it and **Reopen** if needed.",
          "**Questions et réponses → File de modération** : chaque question affiche l’auteur, l’heure et les votes. Utilisez **✓ Marquer répondue** quand l’intervenant y répond, **Écarter** pour la masquer et **Rouvrir** si nécessaire.",
        ),
      ),
      step(
        t(
          "**Encuestas**: en **Nueva encuesta** escribe la pregunta y hasta tres opciones y pulsa **Crear encuesta**; queda como **Borrador**. Durante la sesión pulsa **Abrir encuesta** para que los asistentes voten y **Cerrar encuesta** para congelar resultados. Los porcentajes se actualizan en vivo y las respuestas son anónimas.",
          "**Polls**: in **New poll** type the question and up to three options and click **Create poll**; it is saved as a **Draft**. During the session click **Open poll** so attendees can vote and **Close poll** to freeze results. Percentages update live and answers are anonymous.",
          "**Sondages** : dans **Nouveau sondage**, saisissez la question et jusqu’à trois options puis cliquez sur **Créer le sondage** ; il reste en **Brouillon**. Pendant la session, cliquez sur **Ouvrir le sondage** pour que les participants votent et **Fermer le sondage** pour figer les résultats. Les pourcentages se mettent à jour en direct et les réponses sont anonymes.",
        ),
      ),
      step(
        t(
          "**Chat público**: escribe un **Anuncio del equipo** y pulsa **Publicar** para hablarle a toda la audiencia. Sobre cada mensaje puedes **Retirar mensaje**, **Silenciar 15 min** o **Bloquear** al participante. **Recursos** permite compartir enlaces o archivos (título, URL segura y tipo) con **Agregar recurso**; se muestran en la pestaña Recursos de la sala. El **Canal privado** es un backstage solo para administradores y organizadores.",
          "**Public chat**: write a **Team announcement** and click **Publish** to address the whole audience. On each message you can **Remove message**, **Mute 15 min** or **Block** the participant. **Resources** lets you share links or files (title, secure URL and type) with **Add resource**; they appear in the room's Resources tab. The **Private channel** is a backstage for administrators and organizers only.",
          "**Chat public** : rédigez une **Annonce de l’équipe** et cliquez sur **Publier** pour vous adresser à tout le public. Sur chaque message vous pouvez **Retirer le message**, **Couper 15 min** ou **Bloquer** le participant. **Ressources** permet de partager des liens ou fichiers (titre, URL sécurisée et type) via **Ajouter une ressource** ; ils apparaissent dans l’onglet Ressources de la salle. Le **Canal privé** est une régie réservée aux administrateurs et organisateurs.",
        ),
      ),
      step(
        t(
          "Así ve el participante la sala: escenario con cuenta regresiva o video, pestañas **Chat**, **Preguntas**, **Encuestas** y **Recursos**, y la barra **Reacciona**. Como organizador puedes abrirla desde **Ver como participante**, con las acciones desactivadas.",
          "This is how the participant sees the room: stage with countdown or video, **Chat**, **Questions**, **Polls** and **Resources** tabs, and the **React** bar. As an organizer you can open it from **View as participant**, with actions disabled.",
          "Voici la salle telle que la voit le participant : scène avec compte à rebours ou vidéo, onglets **Chat**, **Questions**, **Sondages** et **Ressources**, et la barre **Réagir**. En tant qu’organisateur, vous pouvez l’ouvrir via **Voir comme participant**, avec les actions désactivées.",
        ),
        { image: img("sala-participante"), caption: t("Sala del participante en vista previa del organizador.", "Participant room in organizer preview.", "Salle du participant en aperçu organisateur.") },
      ),
    ],
  },
  {
    id: "dia-del-evento",
    title: t("El día del evento, en orden", "Event day, in order", "Le jour de l’événement, dans l’ordre"),
    steps: [
      step(
        t(
          "**La víspera**: comprueba en Comunicaciones que el recordatorio de 24 horas salió (contador Enviados) y que no hay mensajes Con error. Confirma que el estado sea **En preparación** o **Registro abierto**.",
          "**The day before**: check in Communications that the 24-hour reminder went out (Sent counter) and that there are no Failed messages. Confirm the status is **Preparing** or **Registration open**.",
          "**La veille** : vérifiez dans Communications que le rappel 24 heures est parti (compteur Envoyés) et qu’il n’y a pas de messages En erreur. Confirmez que le statut est **En préparation** ou **Inscriptions ouvertes**.",
        ),
      ),
      step(
        t(
          "**60 minutos antes**: abre la **Sala técnica**, haz la prueba técnica y revisa que la señal se vea con audio. Deja preparadas las encuestas en borrador y los recursos en Interacción.",
          "**60 minutes before**: open the **Technical room**, run the technical test and check that the signal shows with audio. Leave the polls prepared as drafts and the resources ready in Interaction.",
          "**60 minutes avant** : ouvrez la **Salle technique**, faites le test technique et vérifiez que le signal s’affiche avec le son. Laissez les sondages prêts en brouillon et les ressources dans Interaction.",
        ),
      ),
      step(
        t(
          "**A la hora**: en eventos Simulados la automatización inicia sola. En eventos En vivo, el anfitrión inicia la reunión en Zoom y tú pulsas **Iniciar transmisión desde Zoom**; si el estado no cambió solo, pasa a **En vivo** desde la cabecera. Los inscritos reciben el aviso de inicio.",
          "**At start time**: for Simulated events the automation starts on its own. For Live events, the host starts the meeting in Zoom and you click **Start streaming from Zoom**; if the status did not change by itself, set it to **Live** from the header. Registrants receive the start notice.",
          "**À l’heure** : pour les événements Simulés, l’automatisation démarre seule. Pour les événements En direct, l’hôte démarre la réunion dans Zoom et vous cliquez sur **Démarrer la diffusion depuis Zoom** ; si le statut n’a pas changé tout seul, passez-le **En direct** depuis l’en-tête. Les inscrits reçoivent l’avis de démarrage.",
        ),
      ),
      step(
        t(
          "**Durante**: modera desde **Interacción** (preguntas, chat, encuestas). **Al terminar**: detén la transmisión, cambia el estado a **Completado** y revisa **Analítica** para el informe.",
          "**During**: moderate from **Interaction** (questions, chat, polls). **When it ends**: stop the stream, change the status to **Completed** and review **Analytics** for the report.",
          "**Pendant** : modérez depuis **Interaction** (questions, chat, sondages). **À la fin** : arrêtez la diffusion, passez le statut à **Terminé** et consultez **Analyses** pour le rapport.",
        ),
      ),
    ],
  },
];

// ---------------------------------------------------------------------------
// Guía 2: Participantes
// ---------------------------------------------------------------------------

const participantsSections: HelpGuideSection[] = [
  {
    id: "lista",
    title: t("La lista de participantes", "The participant list", "La liste des participants"),
    intro: t(
      "Participantes reúne a todas las personas registradas en cualquier evento. Cada fila es una persona; una persona puede tener varios registros (uno por evento).",
      "Participants gathers everyone registered for any event. Each row is a person; a person can have several registrations (one per event).",
      "Participants regroupe toutes les personnes inscrites à un événement. Chaque ligne est une personne ; une personne peut avoir plusieurs inscriptions (une par événement).",
    ),
    steps: [
      step(
        t(
          "Abre **Participantes** en el menú lateral. Arriba verás tres totales: **Participantes · registros**, **Asistieron** y **Eventos con registros**. La tabla muestra nombre y correo, empresa y cargo, eventos, último registro y el estado de cada inscripción.",
          "Open **Participants** in the side menu. At the top you see three totals: **Participants · registrations**, **Attended** and **Events with registrations**. The table shows name and email, company and job title, events, last registration and the status of each registration.",
          "Ouvrez **Participants** dans le menu latéral. En haut, trois totaux : **Participants · inscriptions**, **Ont assisté** et **Événements avec inscriptions**. Le tableau affiche nom et e-mail, entreprise et poste, événements, dernière inscription et le statut de chaque inscription.",
        ),
        { image: img("participantes-lista"), caption: t("Lista global de participantes.", "Global participant list.", "Liste globale des participants.") },
      ),
      step(
        t(
          "Filtra con **Buscar nombre, correo, empresa o cargo**, el selector **Evento** (para ver solo los inscritos de un evento) y **Estado**. El contador **resultados** se actualiza al instante y es la vista que luego puedes exportar.",
          "Filter with **Search name, email, company or job title**, the **Event** selector (to see only one event's registrants) and **Status**. The **results** counter updates instantly and is the view you can later export.",
          "Filtrez avec **Rechercher nom, e-mail, entreprise ou poste**, le sélecteur **Événement** (pour ne voir que les inscrits d’un événement) et **Statut**. Le compteur **résultats** se met à jour instantanément et correspond à la vue exportable.",
        ),
      ),
      step(
        t(
          "Los estados de un registro son: **Registrado** (se inscribió), **Confirmado** (confirmó asistencia o fue invitado por el equipo), **Asistido** (entró a la sala con su enlace personal durante el evento; se marca solo) y **Cancelado** (canceló desde su enlace de autogestión o lo cancelaste tú).",
          "Registration statuses are: **Registered** (signed up), **Confirmed** (confirmed attendance or was invited by the team), **Attended** (entered the room with their personal link during the event; set automatically) and **Cancelled** (cancelled from their self-service link or by you).",
          "Les statuts d’une inscription sont : **Inscrit** (s’est inscrit), **Confirmé** (a confirmé sa présence ou a été invité par l’équipe), **Présent** (est entré dans la salle avec son lien personnel pendant l’événement ; automatique) et **Annulé** (a annulé depuis son lien d’autogestion ou vous l’avez annulé).",
        ),
      ),
    ],
  },
  {
    id: "historial-ficha",
    title: t("Historial y ficha de una persona", "A person's history and profile", "Historique et fiche d’une personne"),
    steps: [
      step(
        t(
          "Pulsa **Ver historial** en la fila. Verás empresa, teléfono, número de inscripciones y la lista de **Eventos** en los que participa, cada uno con su fecha, origen (registro público, invitación manual o importación) y un selector de estado que puedes cambiar ahí mismo.",
          "Click **View history** on the row. You see company, phone, number of registrations and the list of **Events** they take part in, each with its date, origin (public registration, manual invitation or import) and a status selector you can change right there.",
          "Cliquez sur **Voir l’historique** sur la ligne. Vous voyez l’entreprise, le téléphone, le nombre d’inscriptions et la liste des **Événements** auxquels la personne participe, chacun avec sa date, son origine (inscription publique, invitation manuelle ou import) et un sélecteur de statut modifiable sur place.",
        ),
        { image: img("participantes-historial"), caption: t("Historial del participante.", "Participant history.", "Historique du participant.") },
      ),
      step(
        t(
          "Pulsa **Ficha** junto a un evento para abrir la **Ficha del participante** de ese registro: empresa, teléfono, consentimiento de marketing, evento, origen, puntaje de interacción y las **Respuestas personalizadas** del formulario. En **Estado del registro** puedes pasarlo a Confirmado, Asistido o Cancelado; el cambio se guarda de inmediato. **Abrir evento ↗** te lleva al evento.",
          "Click **Profile** next to an event to open the **Participant profile** for that registration: company, phone, marketing consent, event, origin, interaction score and the form's **Custom answers**. In **Registration status** you can set it to Confirmed, Attended or Cancelled; the change is saved immediately. **Open event ↗** takes you to the event.",
          "Cliquez sur **Fiche** à côté d’un événement pour ouvrir la **Fiche du participant** de cette inscription : entreprise, téléphone, consentement marketing, événement, origine, score d’interaction et les **Réponses personnalisées** du formulaire. Dans **Statut de l’inscription**, vous pouvez le passer à Confirmé, Présent ou Annulé ; le changement est enregistré immédiatement. **Ouvrir l’événement ↗** vous mène à l’événement.",
        ),
        {
          image: img("participantes-ficha"),
          caption: t("Ficha del participante con el estado del registro.", "Participant profile with registration status.", "Fiche du participant avec le statut de l’inscription."),
          tip: t(
            "Marca **Asistido** a mano solo para quienes participaron por otro canal (por ejemplo, en el auditorio de un evento híbrido). Los que entraron a la sala online se marcan solos.",
            "Set **Attended** manually only for people who took part through another channel (for example, the auditorium of a hybrid event). Those who entered the online room are marked automatically.",
            "Marquez **Présent** manuellement uniquement pour les personnes ayant participé par un autre canal (par exemple l’auditorium d’un événement hybride). Celles entrées dans la salle en ligne sont marquées automatiquement.",
          ),
        },
      ),
    ],
  },
  {
    id: "estados-automaticos",
    title: t("Estados automáticos y eliminación", "Automatic statuses and deletion", "Statuts automatiques et suppression"),
    steps: [
      step(
        t(
          "Los estados cambian solos: al inscribirse la persona queda **Registrado** (o **Confirmado** si la invitaste tú); si cancela desde su enlace personal pasa a **Cancelado**; al entrar a la sala con su enlace mientras el evento está **En vivo** pasa a **Asistió**; y al completarse el evento, quien nunca entró queda como **No asistió**. Puedes corregir cualquier estado a mano desde **Ver historial**.",
          "Statuses change on their own: on sign-up the person is **Registered** (or **Confirmed** if you invited them); if they cancel from their personal link they become **Cancelled**; entering the room with their link while the event is **Live** marks them **Attended**; and when the event is completed, anyone who never entered becomes **No-show**. You can correct any status manually from **View history**.",
          "Les statuts changent automatiquement : à l’inscription la personne est **Inscrite** (ou **Confirmée** si vous l’avez invitée) ; si elle annule depuis son lien personnel elle devient **Annulée** ; entrer dans la salle avec son lien pendant que l’événement est **En direct** la marque **Présente** ; et à la clôture de l’événement, qui n’est jamais entré devient **Absent**. Vous pouvez corriger tout statut à la main depuis **Voir l’historique**.",
        ),
      ),
      step(
        t(
          "Solo un **administrador** ve el botón **Eliminar participante** dentro de **Ver historial**. Borra de forma definitiva sus inscripciones en todos los eventos, sus accesos y los correos pendientes; los registros de consentimiento se conservan sin datos personales, como exige la ley.",
          "Only an **administrator** sees the **Delete participant** button inside **View history**. It permanently removes their registrations in all events, their access links and pending emails; consent records are kept without personal data, as the law requires.",
          "Seul un **administrateur** voit le bouton **Supprimer le participant** dans **Voir l’historique**. Il supprime définitivement ses inscriptions à tous les événements, ses accès et les e-mails en attente ; les registres de consentement sont conservés sans données personnelles, comme l’exige la loi.",
        ),
        {
          warning: t(
            "La eliminación no se puede deshacer. Si solo quieres sacar a alguien de un evento, cambia su estado a Cancelado.",
            "Deletion cannot be undone. If you only want to remove someone from one event, set their status to Cancelled.",
            "La suppression est irréversible. Pour retirer quelqu’un d’un seul événement, passez son statut à Annulé.",
          ),
        },
      ),
    ],
  },
  {
    id: "invitar",
    title: t("Invitar personas una a una", "Invite people one by one", "Inviter des personnes une par une"),
    steps: [
      step(
        t(
          "Pulsa **＋ Invitar participantes** (arriba a la derecha) y deja seleccionada la pestaña **Una persona**. Elige el **Evento**, escribe **Nombre completo** y **Correo electrónico** (obligatorios) y, si los tienes, **Empresa**, **Cargo** y **Teléfono**.",
          "Click **＋ Invite participants** (top right) and keep the **One person** tab selected. Choose the **Event**, type **Full name** and **Email** (required) and, if you have them, **Company**, **Job title** and **Phone**.",
          "Cliquez sur **＋ Inviter des participants** (en haut à droite) et laissez l’onglet **Une personne** sélectionné. Choisissez l’**Événement**, saisissez **Nom complet** et **E-mail** (obligatoires) et, si vous les avez, **Entreprise**, **Poste** et **Téléphone**.",
        ),
        { image: img("participantes-invitar"), caption: t("Invitación individual.", "Individual invitation.", "Invitation individuelle.") },
      ),
      step(
        t(
          "Deja marcada **Preparar comunicaciones automáticas** para que reciba la confirmación con su enlace personal y quede dentro de los recordatorios programados. Pulsa **Crear invitación**. La persona queda con estado **Confirmado** y origen “Invitación manual”.",
          "Keep **Prepare automatic communications** checked so the person receives the confirmation with their personal link and is included in the scheduled reminders. Click **Create invitation**. The person gets the **Confirmed** status and the “Manual invitation” origin.",
          "Laissez **Préparer les communications automatiques** coché pour que la personne reçoive la confirmation avec son lien personnel et soit incluse dans les rappels programmés. Cliquez sur **Créer l’invitation**. La personne obtient le statut **Confirmé** et l’origine « Invitation manuelle ».",
        ),
        {
          warning: t(
            "Si el correo ya está registrado en ese evento, la plataforma no crea un duplicado: te lo indica y puedes reenviar la confirmación desde Comunicaciones.",
            "If the email is already registered for that event, the platform does not create a duplicate: it tells you, and you can resend the confirmation from Communications.",
            "Si l’e-mail est déjà inscrit à cet événement, la plateforme ne crée pas de doublon : elle vous l’indique et vous pouvez renvoyer la confirmation depuis Communications.",
          ),
        },
      ),
    ],
  },
  {
    id: "importar",
    title: t("Importar una lista (CSV)", "Import a list (CSV)", "Importer une liste (CSV)"),
    steps: [
      step(
        t(
          "En la misma ventana elige la pestaña **Importar CSV** y el **Evento** destino. Pulsa **Descargar plantilla de ejemplo (CSV)**: trae los encabezados `nombre,correo,empresa,cargo,telefono` y filas de muestra que puedes reemplazar. Solo nombre y correo son obligatorios; empresa, cargo y teléfono pueden quedar vacíos.",
          "In the same dialog choose the **Import CSV** tab and the target **Event**. Click **Download sample template (CSV)**: it has the headers `nombre,correo,empresa,cargo,telefono` and sample rows you can replace. Only name and email are required; company, job title and phone may be left empty.",
          "Dans la même fenêtre, choisissez l’onglet **Importer un CSV** et l’**Événement** cible. Cliquez sur **Télécharger le modèle d’exemple (CSV)** : il contient les en-têtes `nombre,correo,empresa,cargo,telefono` et des lignes d’exemple à remplacer. Seuls le nom et l’e-mail sont obligatoires ; entreprise, poste et téléphone peuvent rester vides.",
        ),
        { image: img("participantes-csv"), caption: t("Importación por CSV.", "CSV import.", "Import CSV.") },
      ),
      step(
        t(
          "Pulsa **Seleccionar archivo CSV** (máximo 2 MB y 500 filas por carga) o pega el contenido directamente en el cuadro **O pega aquí el contenido**. Con **Preparar comunicaciones automáticas** marcado, cada persona recibirá su confirmación. Pulsa **Importar participantes**.",
          "Click **Select CSV file** (max 2 MB and 500 rows per upload) or paste the content directly in the **Or paste the content here** box. With **Prepare automatic communications** checked, each person receives their confirmation. Click **Import participants**.",
          "Cliquez sur **Sélectionner un fichier CSV** (2 Mo et 500 lignes maximum par import) ou collez le contenu directement dans **Ou collez le contenu ici**. Avec **Préparer les communications automatiques** coché, chaque personne reçoit sa confirmation. Cliquez sur **Importer les participants**.",
        ),
        {
          tip: t(
            "Guarda el archivo desde Excel o Google Sheets como “CSV UTF-8 (delimitado por comas)” para que los acentos se importen bien. Para listas de más de 500 personas, divide el archivo.",
            "Save the file from Excel or Google Sheets as “CSV UTF-8 (comma delimited)” so accents import correctly. For lists over 500 people, split the file.",
            "Enregistrez le fichier depuis Excel ou Google Sheets en « CSV UTF-8 (délimité par des virgules) » pour que les accents s’importent correctement. Au-delà de 500 personnes, divisez le fichier.",
          ),
        },
      ),
      step(
        t(
          "Al terminar, la plataforma indica cuántas filas se importaron, cuántas ya existían y cuáles tenían errores (correo inválido, columnas faltantes). Corrige esas filas y vuelve a importarlas: los ya existentes no se duplican.",
          "When done, the platform reports how many rows were imported, how many already existed and which had errors (invalid email, missing columns). Fix those rows and import them again: existing ones are not duplicated.",
          "À la fin, la plateforme indique combien de lignes ont été importées, combien existaient déjà et lesquelles contenaient des erreurs (e-mail invalide, colonnes manquantes). Corrigez ces lignes et réimportez-les : les existantes ne sont pas dupliquées.",
        ),
      ),
    ],
  },
  {
    id: "exportar",
    title: t("Exportar participantes", "Export participants", "Exporter les participants"),
    steps: [
      step(
        t(
          "Aplica primero los filtros que necesites (evento, estado, búsqueda) y pulsa **↓ Exportar**. La ventana indica cuántos registros se exportarán: siempre la vista filtrada actual.",
          "First apply the filters you need (event, status, search) and click **↓ Export**. The dialog shows how many records will be exported: always the current filtered view.",
          "Appliquez d’abord les filtres nécessaires (événement, statut, recherche) puis cliquez sur **↓ Exporter**. La fenêtre indique combien d’enregistrements seront exportés : toujours la vue filtrée actuelle.",
        ),
        { image: img("participantes-exportar"), caption: t("Selección de columnas y formato de exportación.", "Column and format selection for export.", "Sélection des colonnes et du format d’export.") },
      ),
      step(
        t(
          "Marca o desmarca columnas: Nombre, Correo, Teléfono, Empresa, Cargo, Evento, Estado, Origen, Fecha de registro, Consentimiento de marketing, Puntaje de interacción y Respuestas personalizadas. Pulsa **Descargar CSV** o **Descargar XLSX** (Excel).",
          "Check or uncheck columns: Name, Email, Phone, Company, Job title, Event, Status, Origin, Registration date, Marketing consent, Interaction score and Custom answers. Click **Download CSV** or **Download XLSX** (Excel).",
          "Cochez ou décochez les colonnes : Nom, E-mail, Téléphone, Entreprise, Poste, Événement, Statut, Origine, Date d’inscription, Consentement marketing, Score d’interaction et Réponses personnalisées. Cliquez sur **Télécharger CSV** ou **Télécharger XLSX** (Excel).",
        ),
        {
          warning: t(
            "El archivo contiene datos personales. Compártelo solo con quien lo necesite y respeta la columna **Consentimiento de marketing** antes de usar los correos para otras campañas.",
            "The file contains personal data. Share it only with those who need it and respect the **Marketing consent** column before using the emails for other campaigns.",
            "Le fichier contient des données personnelles. Partagez-le uniquement avec les personnes concernées et respectez la colonne **Consentement marketing** avant d’utiliser les e-mails pour d’autres campagnes.",
          ),
        },
      ),
    ],
  },
  {
    id: "autogestion",
    title: t("Lo que el asistente puede hacer solo", "What attendees can do on their own", "Ce que le participant peut faire seul"),
    steps: [
      step(
        t(
          "Cada correo de confirmación incluye dos enlaces personales: el **enlace de acceso** a la sala (`{{access_link}}`) y el **enlace de gestión** (`{{manage_link}}`) para corregir sus datos, descargar el evento a su calendario o **cancelar** su inscripción hasta el plazo de autogestión definido en la pestaña Registro.",
          "Each confirmation email includes two personal links: the **access link** to the room (`{{access_link}}`) and the **management link** (`{{manage_link}}`) to fix their details, add the event to their calendar or **cancel** their registration until the self-service deadline set in the Registration tab.",
          "Chaque e-mail de confirmation inclut deux liens personnels : le **lien d’accès** à la salle (`{{access_link}}`) et le **lien de gestion** (`{{manage_link}}`) pour corriger ses données, ajouter l’événement à son calendrier ou **annuler** son inscription jusqu’au délai d’autogestion défini dans l’onglet Inscription.",
        ),
      ),
      step(
        t(
          "Si alguien perdió su correo, búscalo en Participantes, abre su **Ficha** y reenvía la confirmación desde la pestaña **Comunicaciones** del evento (**Procesar cola ahora** después de volver a encolarla) o crea una nueva invitación con el mismo correo: la plataforma reutiliza su registro.",
          "If someone lost their email, find them in Participants, open their **Profile** and resend the confirmation from the event's **Communications** tab (**Process queue now** after re-queuing it) or create a new invitation with the same email: the platform reuses their registration.",
          "Si quelqu’un a perdu son e-mail, retrouvez-le dans Participants, ouvrez sa **Fiche** et renvoyez la confirmation depuis l’onglet **Communications** de l’événement (**Traiter la file maintenant** après l’avoir remise en file) ou créez une nouvelle invitation avec le même e-mail : la plateforme réutilise son inscription.",
        ),
      ),
      step(
        t(
          "Las solicitudes de privacidad (acceso, corrección o eliminación de datos) llegan al **Centro de privacidad** del menú lateral; allí las atiendes y quedan registradas en Auditoría.",
          "Privacy requests (access, correction or deletion of data) arrive at the **Privacy center** in the side menu; you handle them there and they are recorded in Audit.",
          "Les demandes de confidentialité (accès, correction ou suppression de données) arrivent dans le **Centre de confidentialité** du menu latéral ; vous les traitez là et elles sont consignées dans Audit.",
        ),
      ),
    ],
  },
];

// ---------------------------------------------------------------------------
// Guía 3: Analítica
// ---------------------------------------------------------------------------

const analyticsSections: HelpGuideSection[] = [
  {
    id: "global",
    title: t("Analítica global", "Global analytics", "Analyses globales"),
    intro: t(
      "La página Analítica del menú lateral consolida todos los eventos. Los datos se actualizan cada vez que la abres.",
      "The Analytics page in the side menu consolidates all events. Data refreshes every time you open it.",
      "La page Analyses du menu latéral consolide tous les événements. Les données se rafraîchissent à chaque ouverture.",
    ),
    steps: [
      step(
        t(
          "Los cuatro indicadores superiores: **Registros** (inscripciones totales y en cuántos eventos), **Visitas a sala** (accesos individuales con enlace personal), **Participación** (porcentaje de asistentes que hicieron algo: pregunta, voto, mensaje o reacción) y **Mensajes preparados** (correos en cola o programados).",
          "The four top indicators: **Registrations** (total sign-ups and across how many events), **Room visits** (individual accesses with a personal link), **Participation** (share of attendees who did something: question, vote, message or reaction) and **Prepared messages** (queued or scheduled emails).",
          "Les quatre indicateurs du haut : **Inscriptions** (total et nombre d’événements), **Visites de salle** (accès individuels avec lien personnel), **Participation** (part des participants ayant agi : question, vote, message ou réaction) et **Messages préparés** (e-mails en file ou programmés).",
        ),
        { image: img("analitica-global"), caption: t("Página Analítica global.", "Global Analytics page.", "Page Analyses globales.") },
      ),
      step(
        t(
          "**Audiencia → Interacción consolidada** suma preguntas, votos y personas activas de todas las salas. **Preparación técnica → Sesiones de streaming** indica cuántas sesiones están listas o en vivo frente al total; las pendientes se completan desde la pestaña Transmisión de cada evento.",
          "**Audience → Consolidated interaction** adds up questions, votes and active people across all rooms. **Technical readiness → Streaming sessions** shows how many sessions are ready or live out of the total; pending ones are completed from each event's Streaming tab.",
          "**Audience → Interaction consolidée** additionne questions, votes et personnes actives de toutes les salles. **Préparation technique → Sessions de streaming** indique combien de sessions sont prêtes ou en direct sur le total ; les sessions en attente se complètent depuis l’onglet Diffusion de chaque événement.",
        ),
      ),
      step(
        t(
          "**Tendencias → Gráficos interactivos**: **Registros por día** (últimos 30 días) y **Estados de registro** (distribución Registrado, Confirmado, Asistido, Cancelado). Filtra por **Evento** con el selector y pasa el cursor sobre el gráfico para ver el detalle. **Descargar PNG ↓** guarda cada gráfico como imagen para tus presentaciones.",
          "**Trends → Interactive charts**: **Registrations per day** (last 30 days) and **Registration statuses** (Registered, Confirmed, Attended, Cancelled distribution). Filter by **Event** with the selector and hover the chart for details. **Download PNG ↓** saves each chart as an image for your presentations.",
          "**Tendances → Graphiques interactifs** : **Inscriptions par jour** (30 derniers jours) et **Statuts d’inscription** (répartition Inscrit, Confirmé, Présent, Annulé). Filtrez par **Événement** avec le sélecteur et survolez le graphique pour le détail. **Télécharger PNG ↓** enregistre chaque graphique en image pour vos présentations.",
        ),
      ),
      step(
        t(
          "**Comparación → Rendimiento por evento** es la tabla para decidir: por cada evento, registros y confirmados, porcentaje de participación y activos, interacciones (preguntas y votos) y estado del streaming. **Ver evento →** abre su analítica detallada.",
          "**Comparison → Performance by event** is the table for decisions: for each event, registrations and confirmed, participation percentage and active people, interactions (questions and votes) and streaming status. **View event →** opens its detailed analytics.",
          "**Comparaison → Performance par événement** est le tableau de décision : pour chaque événement, inscriptions et confirmés, pourcentage de participation et actifs, interactions (questions et votes) et état du streaming. **Voir l’événement →** ouvre ses analyses détaillées.",
        ),
      ),
    ],
  },
  {
    id: "evento",
    title: t("Analítica de un evento", "Analytics of one event", "Analyses d’un événement"),
    steps: [
      step(
        t(
          "Abre el evento y entra a la pestaña **Analítica**. Arriba: **Registrados** (frente a los cupos), **Visitaron la sala** (accesos individuales), **Participación** (participantes activos) y **Mensajes preparados** (con el total de enviados y con error).",
          "Open the event and go to the **Analytics** tab. At the top: **Registered** (against capacity), **Visited the room** (individual accesses), **Participation** (active participants) and **Prepared messages** (with totals sent and failed).",
          "Ouvrez l’événement et allez dans l’onglet **Analyses**. En haut : **Inscrits** (par rapport à la capacité), **Ont visité la salle** (accès individuels), **Participation** (participants actifs) et **Messages préparés** (avec totaux envoyés et en erreur).",
        ),
        { image: img("evento-analitica"), caption: t("Pestaña Analítica de un evento.", "Event Analytics tab.", "Onglet Analyses d’un événement.") },
      ),
      step(
        t(
          "**Conversión → Embudo de asistencia**: Registrados → Confirmados → Visitaron la sala → Asistieron, cada nivel con cantidad y porcentaje sobre el total. Un salto grande entre Confirmados y Visitaron la sala suele indicar que el recordatorio de 1 hora no llegó o que el enlace no se encontró: revisa Comunicaciones.",
          "**Conversion → Attendance funnel**: Registered → Confirmed → Visited the room → Attended, each level with count and percentage of the total. A large drop between Confirmed and Visited the room usually means the 1-hour reminder did not arrive or the link was not found: check Communications.",
          "**Conversion → Entonnoir de présence** : Inscrits → Confirmés → Ont visité la salle → Présents, chaque niveau avec quantité et pourcentage du total. Une forte chute entre Confirmés et Ont visité la salle indique généralement que le rappel 1 heure n’est pas arrivé ou que le lien n’a pas été trouvé : vérifiez Communications.",
        ),
      ),
      step(
        t(
          "**Interacción → Participación de la audiencia**: porcentaje de participación y totales de preguntas, respondidas, encuestas y votos. **Crecimiento → Registros por día** muestra los días con actividad de inscripción: útil para medir el efecto de cada envío o publicación.",
          "**Interaction → Audience participation**: participation percentage and totals of questions, answered, polls and votes. **Growth → Registrations per day** shows the days with sign-up activity: useful to measure the effect of each mailing or post.",
          "**Interaction → Participation du public** : pourcentage de participation et totaux de questions, répondues, sondages et votes. **Croissance → Inscriptions par jour** montre les jours d’activité d’inscription : utile pour mesurer l’effet de chaque envoi ou publication.",
        ),
      ),
      step(
        t(
          "**Operación → Comunicaciones y streaming** resume en cola, programados, enviados y el estado del streaming. **Encuestas → Resultados por pregunta** muestra cada encuesta con votos y porcentaje por opción, incluyendo las que quedaron en borrador.",
          "**Operations → Communications and streaming** summarizes queued, scheduled, sent and the streaming status. **Polls → Results by question** shows each poll with votes and percentage per option, including those left as drafts.",
          "**Opération → Communications et streaming** résume en file, programmés, envoyés et l’état du streaming. **Sondages → Résultats par question** affiche chaque sondage avec votes et pourcentage par option, y compris ceux restés en brouillon.",
        ),
      ),
      step(
        t(
          "**Satisfacción → Feedback post-evento**: con **Encuesta activa al finalizar el evento** marcada, cada asistente recibe en su enlace personal una calificación de 1 a 5 estrellas y un comentario. Aquí ves el promedio, la distribución por estrellas y los comentarios; **Exportar CSV ↓** descarga las respuestas.",
          "**Satisfaction → Post-event feedback**: with **Survey active when the event ends** checked, each attendee gets a 1 to 5 star rating and a comment on their personal link. Here you see the average, the distribution by stars and the comments; **Export CSV ↓** downloads the answers.",
          "**Satisfaction → Feedback post-événement** : avec **Enquête active à la fin de l’événement** coché, chaque participant reçoit sur son lien personnel une note de 1 à 5 étoiles et un commentaire. Vous voyez ici la moyenne, la répartition par étoiles et les commentaires ; **Exporter CSV ↓** télécharge les réponses.",
        ),
      ),
      step(
        t(
          "Para el informe final pulsa **Imprimir / guardar PDF** (arriba a la derecha): se genera una versión limpia de toda la pestaña, sin menús, lista para compartir con el cliente o el equipo.",
          "For the final report click **Print / save PDF** (top right): a clean version of the whole tab is generated, without menus, ready to share with the client or the team.",
          "Pour le rapport final, cliquez sur **Imprimer / enregistrer en PDF** (en haut à droite) : une version propre de tout l’onglet est générée, sans menus, prête à partager avec le client ou l’équipe.",
        ),
        {
          tip: t(
            "Genera el PDF unas horas después de terminar el evento, cuando ya hayan llegado las calificaciones de la encuesta de satisfacción.",
            "Generate the PDF a few hours after the event ends, once the satisfaction survey ratings have come in.",
            "Générez le PDF quelques heures après la fin de l’événement, une fois les notes de l’enquête de satisfaction reçues.",
          ),
        },
      ),
    ],
  },
  {
    id: "auditoria",
    title: t("Auditoría: quién hizo qué", "Audit: who did what", "Audit : qui a fait quoi"),
    steps: [
      step(
        t(
          "**Auditoría** (menú lateral) guarda cada acción administrativa: inicios de sesión, cambios de estado, eliminaciones de eventos, envíos de prueba, cambios de integraciones. Filtra por actor, acción, resultado o módulo y usa **Ver detalle** para ver los datos exactos de cada registro. **Exportar CSV** descarga el historial y **Verificar integridad** comprueba que nadie lo haya alterado.",
          "**Audit** (side menu) stores every administrative action: logins, status changes, event deletions, test sends, integration changes. Filter by actor, action, result or module and use **View detail** to see the exact data of each record. **Export CSV** downloads the history and **Verify integrity** checks that nobody has tampered with it.",
          "**Audit** (menu latéral) conserve chaque action administrative : connexions, changements de statut, suppressions d’événements, envois de test, changements d’intégrations. Filtrez par acteur, action, résultat ou module et utilisez **Voir le détail** pour les données exactes de chaque enregistrement. **Exporter CSV** télécharge l’historique et **Vérifier l’intégrité** contrôle qu’il n’a pas été altéré.",
        ),
        { image: img("auditoria"), caption: t("Registro de actividad en Auditoría.", "Activity log in Audit.", "Journal d’activité dans Audit.") },
      ),
    ],
  },
];

export const helpGuides: HelpArticle[] = [
  {
    slug: "guide-manage-events",
    category: "events",
    subcategory: "event-management",
    featured: true,
    title: t(
      "Gestionar eventos paso a paso",
      "Managing events step by step",
      "Gérer les événements pas à pas",
    ),
    summary: t(
      "Del borrador al informe final: crear, configurar el registro, las comunicaciones, la transmisión y la interacción, y operar el día del evento. Con capturas de cada pantalla.",
      "From draft to final report: create, set up registration, communications, streaming and interaction, and run event day. With screenshots of every screen.",
      "Du brouillon au rapport final : créer, configurer l’inscription, les communications, la diffusion et l’interaction, puis piloter le jour J. Avec des captures de chaque écran.",
    ),
    content: t(
      "Esta guía recorre la pantalla del evento tal como la ves en la plataforma. Sigue las secciones en orden la primera vez; después úsala como referencia rápida desde el índice.",
      "This guide walks through the event screen exactly as you see it in the platform. Follow the sections in order the first time; afterwards use it as a quick reference from the index.",
      "Ce guide parcourt l’écran de l’événement tel que vous le voyez dans la plateforme. Suivez les sections dans l’ordre la première fois ; ensuite utilisez-le comme référence rapide depuis l’index.",
    ),
    keywords: {
      es: ["crear evento", "borrador", "estado", "registro abierto", "en vivo", "completado", "duplicar", "eliminar", "acciones", "agenda", "sesión", "plantilla", "comunicaciones", "recordatorio", "transmisión", "zoom", "ivs", "sala técnica", "interacción", "chat", "encuesta", "preguntas", "compartir", "whatsapp", "linkedin", "miniatura", "fondo", "campos", "calendly", "agendar", "reintentar", "módulos", "reacciones"],
      en: ["create event", "draft", "status", "registration open", "live", "completed", "duplicate", "delete", "actions", "agenda", "session", "template", "communications", "reminder", "streaming", "zoom", "ivs", "technical room", "interaction", "chat", "poll", "questions", "share", "whatsapp", "linkedin", "thumbnail", "background", "fields", "calendly", "schedule", "retry", "modules", "reactions"],
      fr: ["créer un événement", "brouillon", "statut", "inscriptions ouvertes", "en direct", "terminé", "dupliquer", "supprimer", "actions", "agenda", "session", "modèle", "communications", "rappel", "diffusion", "zoom", "ivs", "salle technique", "interaction", "chat", "sondage", "questions", "partager", "whatsapp", "linkedin", "miniature", "fond", "champs", "calendly", "rendez-vous", "réessayer", "modules", "réactions"],
    },
    sections: manageEventsSections,
    related: ["guide-participants", "guide-analytics", "troubleshoot-streaming"],
  },
  {
    slug: "guide-participants",
    category: "events",
    subcategory: "attendees",
    featured: true,
    title: t(
      "Participantes: registros, invitaciones y exportación",
      "Participants: registrations, invitations and export",
      "Participants : inscriptions, invitations et export",
    ),
    summary: t(
      "Cómo leer la lista, cambiar estados, invitar una persona o importar cientos por CSV, exportar a Excel y qué puede hacer cada asistente por su cuenta.",
      "How to read the list, change statuses, invite one person or import hundreds via CSV, export to Excel and what each attendee can do on their own.",
      "Lire la liste, changer les statuts, inviter une personne ou en importer des centaines par CSV, exporter vers Excel et ce que chaque participant peut faire seul.",
    ),
    content: t(
      "La sección Participantes es la base de datos de tu audiencia. Todo lo que hagas aquí se refleja en las comunicaciones y en la analítica de cada evento.",
      "The Participants section is your audience database. Everything you do here is reflected in communications and in each event's analytics.",
      "La section Participants est la base de données de votre public. Tout ce que vous y faites se répercute dans les communications et les analyses de chaque événement.",
    ),
    keywords: {
      es: ["participantes", "inscritos", "invitar", "importar csv", "exportar", "excel", "xlsx", "estado", "confirmado", "asistido", "cancelado", "ficha", "historial", "consentimiento", "autogestión"],
      en: ["participants", "registrants", "invite", "import csv", "export", "excel", "xlsx", "status", "confirmed", "attended", "cancelled", "profile", "history", "consent", "self-service"],
      fr: ["participants", "inscrits", "inviter", "importer csv", "exporter", "excel", "xlsx", "statut", "confirmé", "présent", "annulé", "fiche", "historique", "consentement", "autogestion"],
    },
    sections: participantsSections,
    related: ["guide-manage-events", "guide-analytics", "manage-attendees"],
  },
  {
    slug: "guide-analytics",
    category: "events",
    subcategory: "analytics-data",
    featured: true,
    title: t(
      "Analítica: leer los resultados",
      "Analytics: reading the results",
      "Analyses : lire les résultats",
    ),
    summary: t(
      "Qué significa cada indicador de la analítica global y de cada evento, cómo interpretar el embudo de asistencia, exportar gráficos y generar el informe en PDF.",
      "What each indicator in global and per-event analytics means, how to read the attendance funnel, export charts and generate the PDF report.",
      "Ce que signifie chaque indicateur des analyses globales et par événement, comment lire l’entonnoir de présence, exporter les graphiques et générer le rapport PDF.",
    ),
    content: t(
      "Los datos de analítica provienen de la propia plataforma: registros, accesos a la sala, chat, preguntas, encuestas y correos. No dependen de herramientas externas.",
      "Analytics data comes from the platform itself: registrations, room accesses, chat, questions, polls and emails. It does not depend on external tools.",
      "Les données d’analyse proviennent de la plateforme elle-même : inscriptions, accès à la salle, chat, questions, sondages et e-mails. Elles ne dépendent d’aucun outil externe.",
    ),
    keywords: {
      es: ["analítica", "métricas", "embudo", "asistencia", "participación", "registros por día", "encuestas", "satisfacción", "feedback", "pdf", "informe", "png", "auditoría"],
      en: ["analytics", "metrics", "funnel", "attendance", "participation", "registrations per day", "polls", "satisfaction", "feedback", "pdf", "report", "png", "audit"],
      fr: ["analyses", "métriques", "entonnoir", "présence", "participation", "inscriptions par jour", "sondages", "satisfaction", "feedback", "pdf", "rapport", "png", "audit"],
    },
    sections: analyticsSections,
    related: ["guide-manage-events", "guide-participants", "read-event-analytics"],
  },
];
