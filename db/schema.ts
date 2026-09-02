import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "administrator",
  "organizer",
  "participant",
]);

export const eventOrganizerRole = pgEnum("event_organizer_role", [
  "owner",
  "co_organizer",
]);

export const eventFormat = pgEnum("event_format", [
  "live",
  "simulated",
  "hybrid",
]);

export const eventStatus = pgEnum("event_status", [
  "draft",
  "registration_open",
  "preparing",
  "live",
  "completed",
  "cancelled",
]);

export const registrationStatus = pgEnum("registration_status", [
  "registered",
  "confirmed",
  "attended",
  "absent",
  "cancelled",
]);

export const integrationProvider = pgEnum("integration_provider", [
  "zoom",
  "amazon_ivs",
  "amazon_s3",
  "email",
]);

export const integrationStatus = pgEnum("integration_status", [
  "disconnected",
  "pending",
  "configured",
  "connected",
  "error",
]);

export const identityProtocol = pgEnum("identity_protocol", [
  "oidc",
  "saml",
]);

export const mfaPolicy = pgEnum("mfa_policy", [
  "optional",
  "required_admins",
  "required_all",
]);

export const mfaMethod = pgEnum("mfa_method", [
  "totp",
  "webauthn",
  "email",
]);

export const auditOutcome = pgEnum("audit_outcome", [
  "success",
  "denied",
  "failure",
]);

export const helpLanguage = pgEnum("help_language", ["es", "en", "fr"]);

export const supportRequestStatus = pgEnum("support_request_status", [
  "new",
  "in_progress",
  "resolved",
  "closed",
]);

export const legalDocumentType = pgEnum("legal_document_type", [
  "privacy",
  "terms",
]);

export const legalDocumentStatus = pgEnum("legal_document_status", [
  "draft",
  "published",
  "archived",
]);

export const dataRequestType = pgEnum("data_request_type", [
  "access",
  "correction",
  "deletion",
  "portability",
  "restriction",
]);

export const dataRequestStatus = pgEnum("data_request_status", [
  "submitted",
  "verified",
  "in_progress",
  "completed",
  "rejected",
]);

export const streamingMode = pgEnum("streaming_mode", [
  "zoom_only",
  "zoom_to_ivs",
  "ivs_direct",
  "simulated",
]);

export const streamingStatus = pgEnum("streaming_status", [
  "not_configured",
  "configured",
  "ready",
  "live",
  "ended",
  "error",
]);

export const streamingLatency = pgEnum("streaming_latency", [
  "low",
  "standard",
]);

// Cómo se distribuye el contenido pregrabado (simulado):
// - "direct": servido desde S3 con reloj compartido (barato, sin ABR).
// - "streaming": S3 → emisor efímero → IVS (ABR, experiencia de vivo real).
export const simulatedDelivery = pgEnum("simulated_delivery", [
  "direct",
  "streaming",
]);

// Estado del emisor efímero que empuja contenido de S3 hacia IVS.
export const emitterStatus = pgEnum("emitter_status", [
  "idle",
  "starting",
  "running",
  "stopping",
  "stopped",
  "error",
]);

export const communicationType = pgEnum("communication_type", [
  "registration_confirmation",
  "reminder_24h",
  "reminder_1h",
  "live_now",
  "post_event",
]);

export const communicationStatus = pgEnum("communication_status", [
  "queued",
  "scheduled",
  "sent",
  "failed",
  "cancelled",
]);

export const questionStatus = pgEnum("question_status", [
  "pending",
  "answered",
  "dismissed",
]);

export const pollStatus = pgEnum("poll_status", [
  "draft",
  "open",
  "closed",
]);

export const chatChannel = pgEnum("chat_channel", [
  "public",
  "backstage",
]);

export const chatMessageStatus = pgEnum("chat_message_status", [
  "visible",
  "removed",
]);

export const eventResourceKind = pgEnum("event_resource_kind", [
  "link",
  "file",
]);

export const registrationFieldType = pgEnum("registration_field_type", [
  "text",
  "textarea",
  "select",
  "checkbox",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("participant"),
  active: boolean("active").notNull().default(true),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  timezone: text("timezone"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  mfaEnrolledAt: timestamp("mfa_enrolled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRole("role").notNull(),
    permission: text("permission").notNull(),
    allowed: boolean("allowed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("role_permissions_role_permission_unique").on(
      table.role,
      table.permission,
    ),
  ],
);

export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    allowed: boolean("allowed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_permissions_user_permission_unique").on(
      table.userId,
      table.permission,
    ),
    index("user_permissions_user_idx").on(table.userId),
  ],
);

export const mfaBackupCodes = pgTable(
  "mfa_backup_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("mfa_backup_codes_user_idx").on(table.userId)],
);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  format: eventFormat("format").notNull(),
  status: eventStatus("status").notNull().default("draft"),
  timezone: text("timezone").notNull().default("America/New_York"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  maxAttendees: integer("max_attendees").notNull().default(5000),
  registrationOpen: boolean("registration_open").notNull().default(false),
  selfServiceCutoffMinutes: integer("self_service_cutoff_minutes")
    .notNull()
    .default(0),
  postRegistrationUrl: text("post_registration_url"),
  feedbackEnabled: boolean("feedback_enabled").notNull().default(true),
  feedbackQuestion: text("feedback_question"),
  brandPrimaryColor: text("brand_primary_color"),
  brandAccentColor: text("brand_accent_color"),
  brandBackgroundColor: text("brand_background_color"),
  recordedVideoPath: text("recorded_video_path"),
  recordedVideoName: text("recorded_video_name"),
  recordedVideoSize: integer("recorded_video_size"),
  recordedVideoDurationSeconds: integer("recorded_video_duration_seconds"),
  recordedVideoUploadedAt: timestamp("recorded_video_uploaded_at", {
    withTimezone: true,
  }),
  postEventRedirectUrl: text("post_event_redirect_url"),
  // Contenido simulado elegido de la biblioteca (clave S3), en vez del MP4
  // subido por evento. Cuando está presente, manda sobre recorded_video_path.
  contentAssetId: uuid("content_asset_id"),
  // Modo de distribución del contenido simulado.
  simulatedDelivery: simulatedDelivery("simulated_delivery")
    .notNull()
    .default("streaming"),
  // Evento híbrido: minuto (relativo al inicio) en que la señal en vivo de
  // Zoom cede el paso al contenido simulado. Null = sin transición programada.
  hybridSwitchOffsetMinutes: integer("hybrid_switch_offset_minutes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventOrganizers = pgTable(
  "event_organizers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: eventOrganizerRole("role").notNull().default("co_organizer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_organizers_event_user_unique").on(
      table.eventId,
      table.userId,
    ),
    index("event_organizers_user_idx").on(table.userId),
  ],
);

export const eventTemplates = pgTable(
  "event_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    payload: jsonb("payload").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("event_templates_created_by_idx").on(table.createdBy)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    streamingMode: streamingMode("streaming_mode")
      .notNull()
      .default("zoom_to_ivs"),
    streamingStatus: streamingStatus("streaming_status")
      .notNull()
      .default("not_configured"),
    latencyMode: streamingLatency("latency_mode").notNull().default("low"),
    zoomMeetingId: text("zoom_meeting_id"),
    zoomJoinUrl: text("zoom_join_url"),
    ivsChannelArn: text("ivs_channel_arn"),
    playbackUrl: text("playback_url"),
    recordingEnabled: boolean("recording_enabled").notNull().default(true),
    technicalCheckAt: timestamp("technical_check_at", { withTimezone: true }),
    // Emisor efímero (S3 → IVS): estado y referencia a la tarea de ECS.
    emitterStatus: emitterStatus("emitter_status").notNull().default("idle"),
    emitterTaskArn: text("emitter_task_arn"),
    emitterStartedAt: timestamp("emitter_started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_event_title_unique").on(table.eventId, table.title),
  ],
);

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: registrationStatus("status").notNull().default("registered"),
    company: text("company"),
    jobTitle: text("job_title"),
    phone: text("phone"),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true }),
    source: text("source").notNull().default("registration_page"),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    engagementScore: numeric("engagement_score", { precision: 5, scale: 2 }),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("registrations_event_participant_unique").on(
      table.eventId,
      table.participantId,
    ),
  ],
);

export const registrationAccessTokens = pgTable(
  "registration_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" })
      .unique(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("registration_access_tokens_expires_idx").on(table.expiresAt),
  ],
);

export const eventRegistrationFields = pgTable(
  "event_registration_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    label: text("label").notNull(),
    type: registrationFieldType("type").notNull().default("text"),
    placeholder: text("placeholder"),
    helpText: text("help_text"),
    required: boolean("required").notNull().default(false),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_registration_fields_event_key_unique").on(
      table.eventId,
      table.fieldKey,
    ),
    index("event_registration_fields_event_position_idx").on(
      table.eventId,
      table.position,
    ),
  ],
);

export const registrationFieldResponses = pgTable(
  "registration_field_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => eventRegistrationFields.id, { onDelete: "cascade" }),
    value: text("value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("registration_field_responses_registration_field_unique").on(
      table.registrationId,
      table.fieldId,
    ),
    index("registration_field_responses_field_idx").on(table.fieldId),
  ],
);

export const communicationMessages = pgTable(
  "communication_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    type: communicationType("type").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    offsetMinutes: integer("offset_minutes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("communication_messages_event_type_unique").on(
      table.eventId,
      table.type,
    ),
  ],
);

export const communicationDeliveries = pgTable(
  "communication_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => communicationMessages.id, {
      onDelete: "set null",
    }),
    type: communicationType("type").notNull(),
    status: communicationStatus("status").notNull().default("scheduled"),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull().default(""),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    providerId: text("provider_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("communication_deliveries_registration_type_unique").on(
      table.registrationId,
      table.type,
    ),
    index("communication_deliveries_event_idx").on(table.eventId),
    index("communication_deliveries_status_schedule_idx").on(
      table.status,
      table.scheduledFor,
    ),
  ],
);

export const eventQuestions = pgTable(
  "event_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name"),
    question: text("question").notNull(),
    status: questionStatus("status").notNull().default("pending"),
    upvotes: integer("upvotes").notNull().default(0),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_questions_registration_question_unique").on(
      table.eventId,
      table.registrationId,
      table.question,
    ),
    index("event_questions_event_status_idx").on(table.eventId, table.status),
  ],
);

export const eventFeedbackResponses = pgTable(
  "event_feedback_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_feedback_event_registration_unique").on(
      table.eventId,
      table.registrationId,
    ),
    index("event_feedback_event_idx").on(table.eventId),
  ],
);

export const questionVotes = pgTable(
  "question_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => eventQuestions.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("question_votes_question_registration_unique").on(
      table.questionId,
      table.registrationId,
    ),
    index("question_votes_registration_idx").on(table.registrationId),
  ],
);

export const eventPolls = pgTable(
  "event_polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    status: pollStatus("status").notNull().default("draft"),
    anonymous: boolean("anonymous").notNull().default(true),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_polls_event_question_unique").on(
      table.eventId,
      table.question,
    ),
    index("event_polls_event_status_idx").on(table.eventId, table.status),
  ],
);

export const pollOptions = pgTable(
  "poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => eventPolls.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("poll_options_poll_position_unique").on(
      table.pollId,
      table.position,
    ),
  ],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => eventPolls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("poll_votes_poll_registration_unique").on(
      table.pollId,
      table.registrationId,
    ),
    index("poll_votes_option_idx").on(table.optionId),
  ],
);

export const eventChatMessages = pgTable(
  "event_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    channel: chatChannel("channel").notNull().default("public"),
    message: text("message").notNull(),
    status: chatMessageStatus("status").notNull().default("visible"),
    removedBy: uuid("removed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("event_chat_messages_event_channel_created_idx").on(
      table.eventId,
      table.channel,
      table.createdAt,
    ),
    index("event_chat_messages_registration_idx").on(table.registrationId),
  ],
);

export const eventParticipantModeration = pgTable(
  "event_participant_moderation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    blocked: boolean("blocked").notNull().default(false),
    reason: text("reason"),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_participant_moderation_event_registration_unique").on(
      table.eventId,
      table.registrationId,
    ),
    index("event_participant_moderation_event_idx").on(table.eventId),
  ],
);

export const eventReactions = pgTable(
  "event_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    reaction: text("reaction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("event_reactions_event_created_idx").on(
      table.eventId,
      table.createdAt,
    ),
    index("event_reactions_registration_idx").on(table.registrationId),
  ],
);

export const eventResources = pgTable(
  "event_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    kind: eventResourceKind("kind").notNull().default("link"),
    visible: boolean("visible").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_resources_event_url_unique").on(table.eventId, table.url),
    index("event_resources_event_visible_position_idx").on(
      table.eventId,
      table.visible,
      table.position,
    ),
  ],
);

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: integrationProvider("provider").notNull(),
    status: integrationStatus("status").notNull().default("disconnected"),
    accountLabel: text("account_label"),
    externalAccountId: text("external_account_id"),
    region: text("region"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("integration_provider_unique").on(table.provider),
  ],
);

export const identitySettings = pgTable("identity_settings", {
  id: text("id").primaryKey(),
  status: integrationStatus("status").notNull().default("pending"),
  providerName: text("provider_name"),
  protocol: identityProtocol("protocol").notNull().default("oidc"),
  organizationDomain: text("organization_domain"),
  issuerUrl: text("issuer_url"),
  clientId: text("client_id"),
  entityId: text("entity_id"),
  mfaPolicy: mfaPolicy("mfa_policy").notNull().default("required_admins"),
  mfaMethod: mfaMethod("mfa_method").notNull().default("totp"),
  recoveryCodesRequired: boolean("recovery_codes_required")
    .notNull()
    .default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    outcome: auditOutcome("outcome").notNull().default("success"),
    summary: text("summary").notNull(),
    details: jsonb("details").$type<Record<string, string | number | boolean | null>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    previousHash: text("previous_hash"),
    entryHash: text("entry_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_created_idx").on(table.createdAt),
    index("audit_logs_actor_idx").on(table.actorUserId),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_logs_action_idx").on(table.action),
  ],
);

export const supportRequests = pgTable(
  "support_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterUserId: uuid("requester_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    requesterName: text("requester_name").notNull(),
    requesterEmail: text("requester_email").notNull(),
    language: helpLanguage("language").notNull().default("es"),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    eventTitle: text("event_title"),
    eventDate: timestamp("event_date", { withTimezone: true }),
    eventUrl: text("event_url"),
    affectedEmail: text("affected_email"),
    screenshotUrl: text("screenshot_url"),
    status: supportRequestStatus("status").notNull().default("new"),
    consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true })
      .notNull(),
    retentionUntil: timestamp("retention_until", { withTimezone: true })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("support_requests_email_idx").on(table.requesterEmail),
    index("support_requests_status_idx").on(table.status),
    index("support_requests_created_idx").on(table.createdAt),
  ],
);

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: legalDocumentType("type").notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    content: text("content").notNull(),
    status: legalDocumentStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_documents_type_version_unique").on(
      table.type,
      table.version,
    ),
    index("legal_documents_status_idx").on(table.status),
  ],
);

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
    participantId: uuid("participant_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    privacyDocumentId: uuid("privacy_document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "restrict" }),
    termsDocumentId: uuid("terms_document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "restrict" }),
    privacyVersion: integer("privacy_version").notNull(),
    termsVersion: integer("terms_version").notNull(),
    subjectEmailHash: text("subject_email_hash").notNull(),
    privacyAccepted: boolean("privacy_accepted").notNull().default(true),
    marketingAccepted: boolean("marketing_accepted").notNull().default(false),
    consentText: text("consent_text").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("consent_records_registration_idx").on(table.registrationId),
    index("consent_records_event_idx").on(table.eventId),
    index("consent_records_accepted_idx").on(table.acceptedAt),
  ],
);

export const dataSubjectRequests = pgTable(
  "data_subject_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterName: text("requester_name").notNull(),
    requesterEmail: text("requester_email").notNull(),
    type: dataRequestType("type").notNull(),
    description: text("description"),
    status: dataRequestStatus("status").notNull().default("submitted"),
    identityVerified: boolean("identity_verified").notNull().default(false),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true })
      .notNull(),
    retentionUntil: timestamp("retention_until", { withTimezone: true })
      .notNull(),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    resolutionNotes: text("resolution_notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("data_subject_requests_email_idx").on(table.requesterEmail),
    index("data_subject_requests_status_idx").on(table.status),
    index("data_subject_requests_due_idx").on(table.dueAt),
  ],
);

export const brandSettings = pgTable("brand_settings", {
  id: text("id").primaryKey(),
  organizationName: text("organization_name").notNull().default("Icaza Live"),
  markText: text("mark_text").notNull().default("I"),
  logoUrl: text("logo_url"),
  // Recursos subidos a S3 bajo brand/ (clave del objeto).
  logoLightKey: text("logo_light_key"),
  logoDarkKey: text("logo_dark_key"),
  faviconKey: text("favicon_key"),
  loaderKey: text("loader_key"),
  primaryColor: text("primary_color").notNull().default("#24194F"),
  accentColor: text("accent_color").notNull().default("#6946E8"),
  backgroundColor: text("background_color").notNull().default("#FBFAFC"),
  registrationButtonLabel: text("registration_button_label")
    .notNull()
    .default("Confirmar mi registro"),
  footerText: text("footer_text")
    .notNull()
    .default("Tus datos están protegidos"),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Biblioteca de contenidos: videos en S3 que el gestor puede asignar a un
// evento simulado sin volver a subirlos. La clave S3 es la fuente de la verdad.
export const contentAssets = pgTable(
  "content_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    s3Key: text("s3_key").notNull().unique(),
    sizeBytes: integer("size_bytes"),
    durationSeconds: integer("duration_seconds"),
    contentType: text("content_type").notNull().default("video/mp4"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("content_assets_created_idx").on(table.createdAt)],
);

export type ContentAsset = typeof contentAssets.$inferSelect;
// Configuración de correo saliente editable desde la UI (Integraciones). Alterna
// entre SES-API, SMTP y Resend según el proveedor elegido; la contraseña SMTP se
// guarda cifrada (nunca en texto plano). Cuando existe una fila habilitada, manda
// sobre las variables de entorno del servidor.
export const outboundEmailSettings = pgTable("outbound_email_settings", {
  id: text("id").primaryKey().default("default"),
  provider: text("provider").notNull().default("smtp"),
  enabled: boolean("enabled").notNull().default(false),
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  replyTo: text("reply_to"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  smtpUsername: text("smtp_username"),
  smtpPasswordEncrypted: text("smtp_password_encrypted"),
  region: text("region"),
  configurationSet: text("configuration_set"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OutboundEmailSettings = typeof outboundEmailSettings.$inferSelect;
// Configuración de inicio de sesión con Google (OIDC), editable desde la UI.
// El client secret se guarda cifrado. Por defecto solo entran cuentas de
// personal ya existentes (coincidencia por correo); auto_provision permite
// crear la cuenta en el primer ingreso con el rol indicado.
export const googleSsoSettings = pgTable("google_sso_settings", {
  id: text("id").primaryKey().default("default"),
  enabled: boolean("enabled").notNull().default(false),
  clientId: text("client_id"),
  clientSecretEncrypted: text("client_secret_encrypted"),
  allowedDomain: text("allowed_domain"),
  autoProvision: boolean("auto_provision").notNull().default(false),
  provisionRole: userRole("provision_role").notNull().default("participant"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GoogleSsoSettings = typeof googleSsoSettings.$inferSelect;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
