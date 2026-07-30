import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";
import {
  communicationDeliveries,
  communicationMessages,
  brandSettings,
  eventPolls,
  eventQuestions,
  events,
  identitySettings,
  integrationConnections,
  pollOptions,
  pollVotes,
  registrations,
  sessions,
  users,
} from "../db/schema";
import { hashPassword } from "../lib/password";
import { getLocalDatabasePath } from "../db/local-path";

const dataDirectory = getLocalDatabasePath();
if (!process.env.DATABASE_URL) {
  mkdirSync(dirname(dataDirectory), { recursive: true });
}

const productionClient = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, { max: 1 })
  : null;
const localClient = productionClient
  ? null
  : new PGlite(dataDirectory);
const db: ReturnType<typeof drizzlePglite> = productionClient
  ? (drizzlePostgres(productionClient) as unknown as ReturnType<typeof drizzlePglite>)
  : drizzlePglite(localClient!);

const localAdminPassword =
  process.env.LOCAL_ADMIN_PASSWORD ?? "IcazaLive2026!";
const localAdminPasswordHash = await hashPassword(localAdminPassword);

const [administrator] = await db
  .insert(users)
  .values({
    email: "andres@icazalive.local",
    name: "Andrés Icaza",
    passwordHash: localAdminPasswordHash,
    passwordChangedAt: new Date(),
    role: "administrator",
  })
  .onConflictDoUpdate({
    target: users.email,
    set: {
      name: "Andrés Icaza",
      passwordHash: localAdminPasswordHash,
      passwordChangedAt: new Date(),
      role: "administrator",
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })
  .returning({ id: users.id });

await db
  .insert(brandSettings)
  .values({
    id: "default",
    organizationName: "Icaza Live",
    markText: "I",
    primaryColor: "#24194F",
    accentColor: "#6946E8",
    backgroundColor: "#FBFAFC",
    registrationButtonLabel: "Confirmar mi registro",
    footerText: "Tus datos están protegidos",
    updatedBy: administrator.id,
  })
  .onConflictDoNothing();

const eventSeeds = [
  {
    title: "Liderazgo que transforma",
    slug: "liderazgo-que-transforma",
    description: "Webinar sobre liderazgo y transformación organizacional.",
    format: "live" as const,
    status: "preparing" as const,
    startsAt: new Date("2026-07-28T15:00:00.000Z"),
    endsAt: new Date("2026-07-28T16:30:00.000Z"),
    registrationOpen: true,
  },
  {
    title: "Panorama económico 2026",
    slug: "panorama-economico-2026",
    description: "Evento híbrido para analizar oportunidades del segundo semestre.",
    format: "hybrid" as const,
    status: "registration_open" as const,
    startsAt: new Date("2026-08-05T21:00:00.000Z"),
    endsAt: new Date("2026-08-05T23:00:00.000Z"),
    registrationOpen: true,
  },
  {
    title: "Experiencia de cliente",
    slug: "experiencia-de-cliente",
    description: "Sesión simulada sobre diseño de experiencias memorables.",
    format: "simulated" as const,
    status: "draft" as const,
    startsAt: new Date("2026-08-14T14:00:00.000Z"),
    endsAt: new Date("2026-08-14T15:00:00.000Z"),
    registrationOpen: false,
  },
];

const seededEventIds = new Map<string, string>();
const seededCommunicationMessages = new Map<
  string,
  {
    id: string;
    type: "registration_confirmation" | "reminder_24h" | "reminder_1h" | "post_event";
    subject: string;
    offsetMinutes: number;
    enabled: boolean;
  }[]
>();

const defaultMessages = [
  {
    type: "registration_confirmation" as const,
    subject: "Tu registro a {{event_title}} está confirmado",
    body: "Hola {{participant_name}},\n\nTu registro a {{event_title}} está confirmado.\n\nFecha: {{event_date}}\nEnlace de acceso: {{access_link}}\n\nTe esperamos,\nEquipo Icaza Live",
    enabled: true,
    offsetMinutes: 0,
  },
  {
    type: "reminder_24h" as const,
    subject: "Mañana: {{event_title}}",
    body: "Hola {{participant_name}},\n\nTe recordamos que {{event_title}} comienza mañana.\n\nFecha: {{event_date}}\nEnlace de acceso: {{access_link}}\n\nEquipo Icaza Live",
    enabled: true,
    offsetMinutes: -1440,
  },
  {
    type: "reminder_1h" as const,
    subject: "En una hora comenzamos: {{event_title}}",
    body: "Hola {{participant_name}},\n\nEn una hora comienza {{event_title}}. Puedes ingresar desde este enlace:\n{{access_link}}\n\nEquipo Icaza Live",
    enabled: true,
    offsetMinutes: -60,
  },
  {
    type: "post_event" as const,
    subject: "Gracias por acompañarnos en {{event_title}}",
    body: "Hola {{participant_name}},\n\nGracias por participar en {{event_title}}. Muy pronto compartiremos los recursos y la grabación.\n\nEquipo Icaza Live",
    enabled: false,
    offsetMinutes: 60,
  },
];

for (const eventSeed of eventSeeds) {
  const [event] = await db
    .insert(events)
    .values({ ...eventSeed, createdBy: administrator.id })
    .onConflictDoUpdate({
      target: events.slug,
      set: {
        title: eventSeed.title,
        description: eventSeed.description,
        format: eventSeed.format,
        status: eventSeed.status,
        startsAt: eventSeed.startsAt,
        endsAt: eventSeed.endsAt,
        registrationOpen: eventSeed.registrationOpen,
        updatedAt: new Date(),
      },
    })
    .returning({ id: events.id });
  seededEventIds.set(eventSeed.slug, event.id);

  await db
    .insert(sessions)
    .values({
      eventId: event.id,
      title: "Sesión principal",
      startsAt: eventSeed.startsAt,
      endsAt: eventSeed.endsAt,
      streamingMode:
        eventSeed.format === "simulated" ? "simulated" : "zoom_to_ivs",
    })
    .onConflictDoUpdate({
      target: [sessions.eventId, sessions.title],
      set: {
        startsAt: eventSeed.startsAt,
        endsAt: eventSeed.endsAt,
        streamingMode:
          eventSeed.format === "simulated" ? "simulated" : "zoom_to_ivs",
        updatedAt: new Date(),
      },
    });

  const eventMessages = [];
  for (const message of defaultMessages) {
    await db
      .insert(communicationMessages)
      .values({ ...message, eventId: event.id })
      .onConflictDoNothing();

    const [storedMessage] = await db
      .select({
        id: communicationMessages.id,
        type: communicationMessages.type,
        subject: communicationMessages.subject,
        offsetMinutes: communicationMessages.offsetMinutes,
        enabled: communicationMessages.enabled,
      })
      .from(communicationMessages)
      .where(
        and(
          eq(communicationMessages.eventId, event.id),
          eq(communicationMessages.type, message.type),
        ),
      )
      .limit(1);

    if (storedMessage) eventMessages.push(storedMessage);
  }
  seededCommunicationMessages.set(event.id, eventMessages);
}

const participantSeeds = [
  { name: "María Rodríguez", email: "maria.rodriguez@example.com", company: "Grupo Norte", jobTitle: "Directora de Talento", eventSlug: "liderazgo-que-transforma", status: "confirmed" as const },
  { name: "Felipe Gómez", email: "felipe.gomez@example.com", company: "Nodo Consultores", jobTitle: "Consultor Senior", eventSlug: "liderazgo-que-transforma", status: "registered" as const },
  { name: "Laura Castillo", email: "laura.castillo@example.com", company: "Acme Colombia", jobTitle: "Gerente de Mercadeo", eventSlug: "panorama-economico-2026", status: "registered" as const },
  { name: "Santiago Ruiz", email: "santiago.ruiz@example.com", company: "Finanzas Uno", jobTitle: "Analista Económico", eventSlug: "panorama-economico-2026", status: "confirmed" as const },
  { name: "Daniela Torres", email: "daniela.torres@example.com", company: "Estudio Humano", jobTitle: "Líder de Experiencia", eventSlug: "experiencia-de-cliente", status: "registered" as const },
];

const seededRegistrations = new Map<
  string,
  { id: string; eventId: string }
>();

for (const participantSeed of participantSeeds) {
  const eventId = seededEventIds.get(participantSeed.eventSlug);
  if (!eventId) continue;

  const [participant] = await db
    .insert(users)
    .values({
      name: participantSeed.name,
      email: participantSeed.email,
      role: "participant",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: participantSeed.name,
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  const [registration] = await db
    .insert(registrations)
    .values({
      eventId,
      participantId: participant.id,
      status: participantSeed.status,
      company: participantSeed.company,
      jobTitle: participantSeed.jobTitle,
      marketingConsent: true,
      consentAcceptedAt: new Date(),
      source: "seed",
    })
    .onConflictDoUpdate({
      target: [registrations.eventId, registrations.participantId],
      set: {
        status: participantSeed.status,
        company: participantSeed.company,
        jobTitle: participantSeed.jobTitle,
      },
    })
    .returning({ id: registrations.id });

  const eventSeed = eventSeeds.find(
    (candidate) => candidate.slug === participantSeed.eventSlug,
  );
  if (!registration || !eventSeed) continue;
  seededRegistrations.set(participantSeed.email, {
    id: registration.id,
    eventId,
  });

  for (const message of seededCommunicationMessages.get(eventId) ?? []) {
    if (!message.enabled) continue;
    const now = new Date();
    const scheduledFor =
      message.type === "registration_confirmation"
        ? now
        : new Date(eventSeed.startsAt.getTime() + message.offsetMinutes * 60_000);

    await db
      .insert(communicationDeliveries)
      .values({
        eventId,
        registrationId: registration.id,
        messageId: message.id,
        type: message.type,
        status:
          message.type === "registration_confirmation" ||
          scheduledFor.getTime() <= now.getTime()
            ? "queued"
            : "scheduled",
        recipientEmail: participantSeed.email,
        subject: message.subject,
        scheduledFor,
      })
      .onConflictDoNothing();
  }
}

const leadershipEventId = seededEventIds.get("liderazgo-que-transforma");
const mariaRegistration = seededRegistrations.get(
  "maria.rodriguez@example.com",
);
const felipeRegistration = seededRegistrations.get(
  "felipe.gomez@example.com",
);

if (leadershipEventId && mariaRegistration && felipeRegistration) {
  await db
    .insert(eventQuestions)
    .values([
      {
        eventId: leadershipEventId,
        registrationId: mariaRegistration.id,
        question:
          "¿Cómo mantener al equipo alineado cuando las prioridades cambian rápidamente?",
        status: "pending",
        upvotes: 7,
      },
      {
        eventId: leadershipEventId,
        registrationId: felipeRegistration.id,
        question: "¿Compartirán la presentación y la grabación después del evento?",
        status: "answered",
        upvotes: 3,
        answeredAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(eventPolls)
    .values({
      eventId: leadershipEventId,
      question: "¿Cuál es hoy el mayor reto de liderazgo en tu organización?",
      status: "open",
      anonymous: true,
      launchedAt: new Date(),
    })
    .onConflictDoNothing();

  const [leadershipPoll] = await db
    .select({ id: eventPolls.id })
    .from(eventPolls)
    .where(
      and(
        eq(eventPolls.eventId, leadershipEventId),
        eq(
          eventPolls.question,
          "¿Cuál es hoy el mayor reto de liderazgo en tu organización?",
        ),
      ),
    )
    .limit(1);

  if (leadershipPoll) {
    const optionLabels = [
      "Comunicación y alineación",
      "Gestión del cambio",
      "Desarrollo del talento",
    ];
    for (const [position, label] of optionLabels.entries()) {
      await db
        .insert(pollOptions)
        .values({ pollId: leadershipPoll.id, label, position })
        .onConflictDoNothing();
    }

    const storedOptions = await db
      .select({ id: pollOptions.id, position: pollOptions.position })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, leadershipPoll.id))
      .orderBy(pollOptions.position);
    const firstOption = storedOptions.find((option) => option.position === 0);
    const secondOption = storedOptions.find((option) => option.position === 1);

    if (firstOption) {
      await db
        .insert(pollVotes)
        .values({
          pollId: leadershipPoll.id,
          optionId: firstOption.id,
          registrationId: mariaRegistration.id,
        })
        .onConflictDoNothing();
    }
    if (secondOption) {
      await db
        .insert(pollVotes)
        .values({
          pollId: leadershipPoll.id,
          optionId: secondOption.id,
          registrationId: felipeRegistration.id,
        })
        .onConflictDoNothing();
    }
  }
}

await db
  .insert(integrationConnections)
  .values([
    { provider: "zoom", status: "pending", accountLabel: "Cuenta por conectar" },
    { provider: "amazon_ivs", status: "disconnected", accountLabel: "Entorno local", region: process.env.AWS_REGION ?? "us-east-1" },
    { provider: "amazon_s3", status: "disconnected", accountLabel: "Grabaciones", region: process.env.AWS_REGION ?? "us-east-1" },
  ])
  .onConflictDoNothing();

await db
  .insert(identitySettings)
  .values({
    id: "default",
    status: "pending",
    providerName: "Proveedor corporativo",
    protocol: "oidc",
    mfaPolicy: "required_admins",
    mfaMethod: "totp",
    recoveryCodesRequired: true,
    updatedBy: administrator.id,
  })
  .onConflictDoNothing();

if (productionClient) await productionClient.end();
if (localClient) await localClient.close();

console.log("Datos iniciales de Icaza Live creados.");
