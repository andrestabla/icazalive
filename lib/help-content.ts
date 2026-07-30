export type HelpLocale = "es" | "en" | "fr";
export type LocalizedText = Record<HelpLocale, string>;

export type HelpCategory = {
  id: string;
  icon: string;
  label: LocalizedText;
  description: LocalizedText;
  subcategories?: { id: string; label: LocalizedText }[];
};

export type HelpArticle = {
  slug: string;
  category: string;
  subcategory?: string;
  title: LocalizedText;
  summary: LocalizedText;
  content: LocalizedText;
  keywords: Record<HelpLocale, string[]>;
  featured?: boolean;
};

const text = (es: string, en: string, fr: string): LocalizedText => ({
  es,
  en,
  fr,
});

export const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    icon: "↗",
    label: text("Primeros pasos", "Getting Started", "Bien démarrer"),
    description: text(
      "Configura tu espacio y publica el primer evento.",
      "Set up your workspace and publish your first event.",
      "Configurez votre espace et publiez votre premier événement.",
    ),
  },
  {
    id: "events",
    icon: "◫",
    label: text("Eventos", "Events", "Événements"),
    description: text(
      "Planificación, asistentes, sala, marca y resultados.",
      "Planning, attendees, room, branding, and results.",
      "Planification, participants, salle, marque et résultats.",
    ),
    subcategories: [
      {
        id: "analytics-data",
        label: text("Analítica y datos", "Analytics & data", "Analyses et données"),
      },
      {
        id: "attendees",
        label: text("Participantes", "Attendees", "Participants"),
      },
      {
        id: "customization",
        label: text("Personalización", "Customization", "Personnalisation"),
      },
      {
        id: "event-management",
        label: text("Gestión del evento", "Event management", "Gestion de l’événement"),
      },
      {
        id: "event-room",
        label: text("Sala del evento", "Event room", "Salle de l’événement"),
      },
      {
        id: "troubleshooting",
        label: text("Solución de problemas", "Troubleshooting", "Dépannage"),
      },
    ],
  },
  {
    id: "account",
    icon: "♙",
    label: text("Cuenta", "Account", "Compte"),
    description: text(
      "Equipo, configuración y seguridad de los datos.",
      "Team, settings, and data security.",
      "Équipe, paramètres et sécurité des données.",
    ),
    subcategories: [
      { id: "settings", label: text("Configuración", "Settings", "Paramètres") },
      { id: "billing", label: text("Facturación", "Billing", "Facturation") },
      {
        id: "data-security",
        label: text("Datos y seguridad", "Data & security", "Données et sécurité"),
      },
    ],
  },
  {
    id: "integrations",
    icon: "⌘",
    label: text("Integraciones", "Integrations", "Intégrations"),
    description: text(
      "Conecta Zoom, AWS, SSO y servicios externos.",
      "Connect Zoom, AWS, SSO, and external services.",
      "Connectez Zoom, AWS, SSO et des services externes.",
    ),
  },
  {
    id: "videos",
    icon: "▷",
    label: text("Videos", "Videos", "Vidéos"),
    description: text(
      "Streaming, grabaciones y reproducción.",
      "Streaming, recordings, and playback.",
      "Streaming, enregistrements et lecture.",
    ),
  },
  {
    id: "community",
    icon: "♧",
    label: text("Comunidad", "Community", "Communauté"),
    description: text(
      "Buenas prácticas para producir mejores eventos.",
      "Best practices for producing better events.",
      "Bonnes pratiques pour produire de meilleurs événements.",
    ),
  },
  {
    id: "help",
    icon: "?",
    label: text("Ayuda", "Help", "Aide"),
    description: text(
      "Reporta incidentes y contacta al equipo de soporte.",
      "Report incidents and contact the support team.",
      "Signalez des incidents et contactez le support.",
    ),
  },
];

export const helpArticles: HelpArticle[] = [
  {
    slug: "configure-your-workspace",
    category: "getting-started",
    title: text(
      "Configura tu espacio de trabajo",
      "Set up your workspace",
      "Configurer votre espace de travail",
    ),
    summary: text(
      "Revisa equipo, marca e integraciones antes de crear eventos.",
      "Review team, branding, and integrations before creating events.",
      "Vérifiez l’équipe, la marque et les intégrations avant de créer des événements.",
    ),
    content: text(
      "1. Invita al equipo y asigna roles desde Equipo.\n\n2. Configura colores, logotipo y textos en Marca.\n\n3. Abre los asistentes de Zoom, AWS y SSO/MFA en Integraciones.\n\n4. Conserva las credenciales únicamente en variables seguras del servidor.",
      "1. Invite your team and assign roles from Team.\n\n2. Configure colors, logo, and copy in Brand.\n\n3. Open the Zoom, AWS, and SSO/MFA assistants in Integrations.\n\n4. Keep credentials only in secure server variables.",
      "1. Invitez votre équipe et attribuez les rôles dans Équipe.\n\n2. Configurez les couleurs, le logo et les textes dans Marque.\n\n3. Ouvrez les assistants Zoom, AWS et SSO/MFA dans Intégrations.\n\n4. Conservez les identifiants uniquement dans les variables sécurisées du serveur.",
    ),
    keywords: {
      es: ["inicio", "configurar", "equipo", "marca"],
      en: ["start", "setup", "team", "brand"],
      fr: ["début", "configurer", "équipe", "marque"],
    },
    featured: true,
  },
  {
    slug: "create-first-event",
    category: "events",
    subcategory: "event-management",
    title: text(
      "Crea y publica tu primer evento",
      "Create and publish your first event",
      "Créer et publier votre premier événement",
    ),
    summary: text(
      "Define horario, formato, registro y sesiones.",
      "Define schedule, format, registration, and sessions.",
      "Définissez l’horaire, le format, l’inscription et les sessions.",
    ),
    content: text(
      "Crea el evento desde el catálogo y completa título, formato y horario. Agrega o ajusta sesiones dentro del rango del evento. Revisa Registro, Comunicaciones y Transmisión antes de abrir las inscripciones. Cambia el estado solo cuando la configuración esté lista.",
      "Create the event from the catalog and complete its title, format, and schedule. Add or adjust sessions within the event time range. Review Registration, Communications, and Streaming before opening registration. Change status only when configuration is ready.",
      "Créez l’événement depuis le catalogue et complétez le titre, le format et l’horaire. Ajoutez ou ajustez les sessions dans la plage de l’événement. Vérifiez Inscription, Communications et Streaming avant d’ouvrir les inscriptions.",
    ),
    keywords: {
      es: ["evento", "crear", "publicar", "sesión"],
      en: ["event", "create", "publish", "session"],
      fr: ["événement", "créer", "publier", "session"],
    },
    featured: true,
  },
  {
    slug: "manage-attendees",
    category: "events",
    subcategory: "attendees",
    title: text(
      "Gestiona participantes y estados",
      "Manage attendees and statuses",
      "Gérer les participants et les statuts",
    ),
    summary: text(
      "Busca, filtra, actualiza y exporta registros.",
      "Search, filter, update, and export registrations.",
      "Recherchez, filtrez, mettez à jour et exportez les inscriptions.",
    ),
    content: text(
      "Usa Participantes para buscar por nombre o correo y filtrar por evento o estado. Abre Gestionar para confirmar asistencia, cancelar o corregir el estado. Exporta la vista filtrada a CSV y evita compartir archivos con personas no autorizadas.",
      "Use Attendees to search by name or email and filter by event or status. Open Manage to confirm attendance, cancel, or correct status. Export the filtered view to CSV and avoid sharing files with unauthorized people.",
      "Utilisez Participants pour rechercher par nom ou e-mail et filtrer par événement ou statut. Ouvrez Gérer pour confirmer la présence, annuler ou corriger le statut. Exportez la vue filtrée en CSV.",
    ),
    keywords: {
      es: ["participantes", "registro", "estado", "csv"],
      en: ["attendees", "registration", "status", "csv"],
      fr: ["participants", "inscription", "statut", "csv"],
    },
  },
  {
    slug: "read-event-analytics",
    category: "events",
    subcategory: "analytics-data",
    title: text(
      "Interpreta la analítica del evento",
      "Read event analytics",
      "Comprendre les analyses de l’événement",
    ),
    summary: text(
      "Comprende registro, asistencia e interacción.",
      "Understand registration, attendance, and engagement.",
      "Comprenez l’inscription, la présence et l’engagement.",
    ),
    content: text(
      "El embudo compara registrados, confirmados y asistentes. La participación resume preguntas, votos y actividad de la sala. Usa la vista global para comparar eventos y revisa cada ficha antes de exportar datos personales.",
      "The funnel compares registered, confirmed, and attended users. Engagement summarizes questions, votes, and room activity. Use the global view to compare events and review each record before exporting personal data.",
      "L’entonnoir compare les inscrits, confirmés et participants. L’engagement résume les questions, votes et l’activité de la salle. Utilisez la vue globale pour comparer les événements.",
    ),
    keywords: {
      es: ["analítica", "asistencia", "métricas", "embudo"],
      en: ["analytics", "attendance", "metrics", "funnel"],
      fr: ["analyses", "présence", "mesures", "entonnoir"],
    },
  },
  {
    slug: "customize-event-experience",
    category: "events",
    subcategory: "customization",
    title: text(
      "Personaliza la experiencia pública",
      "Customize the public experience",
      "Personnaliser l’expérience publique",
    ),
    summary: text(
      "Aplica marca a registro y sala.",
      "Apply branding to registration and room pages.",
      "Appliquez la marque aux pages d’inscription et à la salle.",
    ),
    content: text(
      "En Marca configura organización, símbolo, logotipo, colores y textos. La vista previa se actualiza antes de guardar. Verifica contraste, legibilidad y consistencia en móvil. Los cambios globales se aplican a registro y sala pública.",
      "In Brand, configure organization, mark, logo, colors, and copy. Preview updates before saving. Verify contrast, readability, and mobile consistency. Global changes apply to registration and the public room.",
      "Dans Marque, configurez l’organisation, le symbole, le logo, les couleurs et les textes. L’aperçu se met à jour avant l’enregistrement. Vérifiez le contraste et la lisibilité mobile.",
    ),
    keywords: {
      es: ["marca", "colores", "logo", "registro"],
      en: ["brand", "colors", "logo", "registration"],
      fr: ["marque", "couleurs", "logo", "inscription"],
    },
  },
  {
    slug: "prepare-event-room",
    category: "events",
    subcategory: "event-room",
    title: text(
      "Prepara la sala y la interacción",
      "Prepare the room and engagement",
      "Préparer la salle et l’interaction",
    ),
    summary: text(
      "Valida transmisión, Q&A y encuestas antes de abrir.",
      "Validate streaming, Q&A, and polls before opening.",
      "Validez le streaming, les questions-réponses et les sondages avant l’ouverture.",
    ),
    content: text(
      "Ejecuta la revisión técnica desde Transmisión. Confirma que la sesión, la fuente de video y el destino de reproducción estén listos. Prepara preguntas y encuestas, abre el estudio y usa la sala pública en modo de vista previa antes del evento.",
      "Run the technical check from Streaming. Confirm the session, video source, and playback destination are ready. Prepare questions and polls, open the studio, and use the public room in preview mode before the event.",
      "Exécutez la vérification technique depuis Streaming. Confirmez que la session, la source vidéo et la lecture sont prêtes. Préparez les questions et sondages, puis testez la salle publique.",
    ),
    keywords: {
      es: ["sala", "estudio", "preguntas", "encuestas"],
      en: ["room", "studio", "questions", "polls"],
      fr: ["salle", "studio", "questions", "sondages"],
    },
    featured: true,
  },
  {
    slug: "troubleshoot-streaming",
    category: "events",
    subcategory: "troubleshooting",
    title: text(
      "Soluciona una transmisión no preparada",
      "Troubleshoot a stream that is not ready",
      "Dépanner une diffusion non prête",
    ),
    summary: text(
      "Revisa credenciales, recursos y URLs sin exponer secretos.",
      "Review credentials, resources, and URLs without exposing secrets.",
      "Vérifiez les identifiants, ressources et URL sans exposer de secrets.",
    ),
    content: text(
      "Abre Integraciones y confirma los requisitos de Zoom, IVS y S3. Revisa región, ARN, bucket y URL de reproducción. Ejecuta de nuevo la revisión técnica. Si reportas el incidente, incluye evento, fecha, enlace, usuario afectado y captura; nunca envíes claves ni tokens.",
      "Open Integrations and confirm Zoom, IVS, and S3 requirements. Review region, ARN, bucket, and playback URL. Run the technical check again. When reporting, include event, date, link, affected user, and screenshot; never send keys or tokens.",
      "Ouvrez Intégrations et confirmez les exigences Zoom, IVS et S3. Vérifiez la région, l’ARN, le bucket et l’URL de lecture. Relancez la vérification technique. Ne transmettez jamais de clés ni de jetons.",
    ),
    keywords: {
      es: ["error", "streaming", "zoom", "aws", "ivs"],
      en: ["error", "streaming", "zoom", "aws", "ivs"],
      fr: ["erreur", "streaming", "zoom", "aws", "ivs"],
    },
  },
  {
    slug: "protect-account",
    category: "account",
    subcategory: "data-security",
    title: text(
      "Protege el acceso y los datos",
      "Protect access and data",
      "Protéger l’accès et les données",
    ),
    summary: text(
      "Roles, contraseñas, SSO/MFA y auditoría.",
      "Roles, passwords, SSO/MFA, and audit.",
      "Rôles, mots de passe, SSO/MFA et audit.",
    ),
    content: text(
      "Asigna el menor privilegio necesario. Restablece credenciales temporales desde Equipo y revoca cuentas que ya no se usan. Preconfigura SSO/MFA en Integraciones y consulta Auditoría para revisar accesos y cambios críticos. No almacenes secretos en formularios.",
      "Assign the least privilege required. Reset temporary credentials from Team and revoke unused accounts. Preconfigure SSO/MFA in Integrations and review Audit for access and critical changes. Do not store secrets in forms.",
      "Attribuez le minimum de privilèges nécessaire. Réinitialisez les identifiants temporaires et révoquez les comptes inutilisés. Préconfigurez SSO/MFA et consultez l’Audit.",
    ),
    keywords: {
      es: ["seguridad", "mfa", "sso", "auditoría"],
      en: ["security", "mfa", "sso", "audit"],
      fr: ["sécurité", "mfa", "sso", "audit"],
    },
  },
  {
    slug: "configure-zoom-aws-sso",
    category: "integrations",
    title: text(
      "Usa los asistentes de Zoom, AWS y SSO",
      "Use the Zoom, AWS, and SSO assistants",
      "Utiliser les assistants Zoom, AWS et SSO",
    ),
    summary: text(
      "Qué guarda cada asistente y qué debe ir en Secrets.",
      "What each assistant stores and what belongs in Secrets.",
      "Ce que chaque assistant stocke et ce qui doit rester dans Secrets.",
    ),
    content: text(
      "Los asistentes guardan nombres, IDs, región, referencias de recursos y políticas. ZOOM_CLIENT_SECRET, AWS_SECRET_ACCESS_KEY, certificados SAML y claves de cifrado permanecen en el servidor. Guardar y revisar valida presencia y formato, pero no activa proveedores externos.",
      "Assistants store names, IDs, region, resource references, and policies. ZOOM_CLIENT_SECRET, AWS_SECRET_ACCESS_KEY, SAML certificates, and encryption keys remain on the server. Save and review validates presence and format but does not activate external providers.",
      "Les assistants stockent les noms, identifiants, régions, références et politiques. Les secrets Zoom/AWS, certificats SAML et clés de chiffrement restent sur le serveur.",
    ),
    keywords: {
      es: ["integraciones", "secrets", "oauth", "iam"],
      en: ["integrations", "secrets", "oauth", "iam"],
      fr: ["intégrations", "secrets", "oauth", "iam"],
    },
    featured: true,
  },
  {
    slug: "recordings-and-video",
    category: "videos",
    title: text(
      "Prepara grabaciones y reproducción",
      "Prepare recordings and playback",
      "Préparer les enregistrements et la lecture",
    ),
    summary: text(
      "Configura S3, reproducción y permisos.",
      "Configure S3, playback, and permissions.",
      "Configurez S3, la lecture et les autorisations.",
    ),
    content: text(
      "Activa la grabación por sesión y define un bucket S3 con permisos mínimos. Valida la URL de reproducción antes del evento. Las grabaciones deben tener políticas de retención y acceso; no publiques URLs privadas sin controles.",
      "Enable recording per session and define an S3 bucket with least-privilege permissions. Validate the playback URL before the event. Recordings require retention and access policies; do not publish private URLs without controls.",
      "Activez l’enregistrement par session et définissez un bucket S3 avec des autorisations minimales. Validez l’URL de lecture. Les enregistrements nécessitent des politiques de conservation et d’accès.",
    ),
    keywords: {
      es: ["video", "grabación", "s3", "reproducción"],
      en: ["video", "recording", "s3", "playback"],
      fr: ["vidéo", "enregistrement", "s3", "lecture"],
    },
  },
  {
    slug: "event-production-checklist",
    category: "community",
    title: text(
      "Checklist para producir un evento confiable",
      "Checklist for a reliable event",
      "Checklist pour un événement fiable",
    ),
    summary: text(
      "Coordina contenido, equipo, pruebas y seguimiento.",
      "Coordinate content, team, tests, and follow-up.",
      "Coordonnez le contenu, l’équipe, les tests et le suivi.",
    ),
    content: text(
      "48 horas antes: confirma presentadores, mensajes y registro. 24 horas antes: ejecuta la prueba técnica completa. 1 hora antes: abre estudio, revisa interacción y enlaces. Después: cierra encuestas, valida grabación y revisa analítica y entregas.",
      "48 hours before: confirm presenters, messages, and registration. 24 hours before: run the full technical test. 1 hour before: open the studio and review engagement and links. Afterward: close polls, validate the recording, and review analytics and deliveries.",
      "48 heures avant : confirmez les intervenants, messages et inscriptions. 24 heures avant : effectuez le test technique. 1 heure avant : ouvrez le studio. Après : fermez les sondages et vérifiez l’enregistrement.",
    ),
    keywords: {
      es: ["checklist", "producción", "prueba", "evento"],
      en: ["checklist", "production", "test", "event"],
      fr: ["checklist", "production", "test", "événement"],
    },
  },
  {
    slug: "report-support-incident",
    category: "help",
    title: text(
      "Reporta un incidente de forma efectiva",
      "Report an incident effectively",
      "Signaler efficacement un incident",
    ),
    summary: text(
      "Incluye el contexto necesario y evita solicitudes duplicadas.",
      "Include the required context and avoid duplicate requests.",
      "Incluez le contexte nécessaire et évitez les demandes en double.",
    ),
    content: text(
      "Incluye título y fecha del evento, enlace afectado, correo de la persona afectada, pasos para reproducir y una captura sin datos sensibles. Describe qué esperabas y qué ocurrió. Envía una sola solicitud por incidente: una solicitud duplicada retrasa la clasificación. Nunca adjuntes contraseñas, tokens o claves.",
      "Include event title and date, affected link, affected person's email, reproduction steps, and a screenshot without sensitive data. Describe expected and actual behavior. Send one request per incident; duplicates slow triage. Never attach passwords, tokens, or keys.",
      "Indiquez le titre et la date de l’événement, le lien concerné, l’e-mail de la personne affectée, les étapes de reproduction et une capture sans données sensibles. Envoyez une seule demande et ne joignez jamais de mots de passe ou de clés.",
    ),
    keywords: {
      es: ["soporte", "incidente", "captura", "error"],
      en: ["support", "incident", "screenshot", "error"],
      fr: ["support", "incident", "capture", "erreur"],
    },
    featured: true,
  },
];

export function categoryById(id: string) {
  return helpCategories.find((category) => category.id === id);
}

export function articleBySlug(slug: string) {
  return helpArticles.find((article) => article.slug === slug);
}
