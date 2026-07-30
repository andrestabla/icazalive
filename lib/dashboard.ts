import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  brandSettings,
  communicationDeliveries,
  eventQuestions,
  events,
  integrationConnections,
  pollVotes,
  registrations,
  sessions,
  users,
} from "@/db/schema";

export type DashboardSummary = {
  generatedAt: string;
  metrics: {
    events: number;
    registrations: number;
    attendanceRate: number;
    participationRate: number;
  };
  events: {
    id: string;
    slug: string;
    title: string;
    format: "live" | "simulated" | "hybrid";
    status:
      | "draft"
      | "registration_open"
      | "preparing"
      | "live"
      | "completed"
      | "cancelled";
    startsAt: string;
    registrations: number;
    streamingReady: boolean;
  }[];
  integrations: {
    provider: "zoom" | "amazon_ivs";
    status: "disconnected" | "pending" | "configured" | "connected" | "error";
    accountLabel: string | null;
  }[];
  notifications: {
    id: string;
    title: string;
    detail: string;
    href: string;
    tone: "warning" | "info" | "error";
  }[];
  notificationCount: number;
  activity: {
    id: string;
    initials: string;
    action: string;
    subject: string;
    occurredAt: string;
    href: string;
  }[];
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const db = getDb();
  const now = new Date();
  const [
    eventRecords,
    registrationRecords,
    questionRecords,
    voteRecords,
    sessionRecords,
    integrationRecords,
    failedDeliveries,
    brandRecords,
    teamRecords,
  ] = await Promise.all([
    db
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        format: events.format,
        status: events.status,
        startsAt: events.startsAt,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        creatorName: users.name,
      })
      .from(events)
      .innerJoin(users, eq(events.createdBy, users.id))
      .orderBy(events.startsAt),
    db
      .select({
        id: registrations.id,
        eventId: registrations.eventId,
        status: registrations.status,
        registeredAt: registrations.registeredAt,
        participantName: users.name,
        eventTitle: events.title,
        eventSlug: events.slug,
      })
      .from(registrations)
      .innerJoin(users, eq(registrations.participantId, users.id))
      .innerJoin(events, eq(registrations.eventId, events.id))
      .orderBy(desc(registrations.registeredAt)),
    db
      .select({ registrationId: eventQuestions.registrationId })
      .from(eventQuestions),
    db
      .select({ registrationId: pollVotes.registrationId })
      .from(pollVotes),
    db
      .select({
        eventId: sessions.eventId,
        status: sessions.streamingStatus,
      })
      .from(sessions),
    db
      .select({
        provider: integrationConnections.provider,
        status: integrationConnections.status,
        accountLabel: integrationConnections.accountLabel,
      })
      .from(integrationConnections),
    db
      .select({ id: communicationDeliveries.id })
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.status, "failed")),
    db
      .select({
        id: brandSettings.id,
        organizationName: brandSettings.organizationName,
        updatedAt: brandSettings.updatedAt,
        updaterName: users.name,
      })
      .from(brandSettings)
      .leftJoin(users, eq(brandSettings.updatedBy, users.id)),
    db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(inArray(users.role, ["administrator", "organizer"])),
  ]);

  const activeRegistrations = registrationRecords.filter(
    (record) => record.status !== "cancelled",
  );
  const confirmed = activeRegistrations.filter(
    (record) =>
      record.status === "confirmed" || record.status === "attended",
  ).length;
  const attended = activeRegistrations.filter(
    (record) => record.status === "attended",
  ).length;
  const engagedRegistrationIds = new Set(
    [...questionRecords, ...voteRecords]
      .map((record) => record.registrationId)
      .filter((id): id is string => Boolean(id)),
  );

  const eventRegistrationCounts = new Map<string, number>();
  for (const registration of activeRegistrations) {
    eventRegistrationCounts.set(
      registration.eventId,
      (eventRegistrationCounts.get(registration.eventId) ?? 0) + 1,
    );
  }
  const readyEventIds = new Set(
    sessionRecords
      .filter(
        (session) =>
          session.status === "ready" || session.status === "live",
      )
      .map((session) => session.eventId),
  );
  const currentEvents = eventRecords.filter(
    (event) =>
      event.startsAt.getTime() >= now.getTime() &&
      event.status !== "cancelled" &&
      event.status !== "completed",
  );

  const notifications: DashboardSummary["notifications"] = [];
  for (const event of currentEvents) {
    const pendingSessions = sessionRecords.filter(
      (session) =>
        session.eventId === event.id &&
        session.status !== "ready" &&
        session.status !== "live",
    ).length;
    if (pendingSessions) {
      notifications.push({
        id: `streaming-${event.id}`,
        title: "Transmisión pendiente",
        detail: `${event.title}: ${pendingSessions} sesión${pendingSessions === 1 ? "" : "es"} requiere${pendingSessions === 1 ? "" : "n"} revisión técnica.`,
        href: `/events/${event.slug}`,
        tone: "warning",
      });
    }
    if (!["registration_open", "live"].includes(event.status)) {
      notifications.push({
        id: `registration-${event.id}`,
        title: "Registro cerrado",
        detail: `${event.title} todavía no acepta inscripciones.`,
        href: `/events/${event.slug}`,
        tone: "info",
      });
    }
  }
  for (const integration of integrationRecords) {
    if (
      (integration.provider === "zoom" ||
        integration.provider === "amazon_ivs") &&
      integration.status !== "connected"
    ) {
      notifications.push({
        id: `integration-${integration.provider}`,
        title:
          integration.provider === "zoom"
            ? "Zoom requiere conexión"
            : "Amazon IVS requiere conexión",
        detail:
          integration.status === "configured"
            ? "La configuración está guardada y pendiente de validación real."
            : "Completa las variables y verifica la integración.",
        href: "/integrations",
        tone: integration.status === "error" ? "error" : "warning",
      });
    }
  }
  if (failedDeliveries.length) {
    notifications.push({
      id: "failed-communications",
      title: "Comunicaciones con error",
      detail: `${failedDeliveries.length} entrega${failedDeliveries.length === 1 ? "" : "s"} requiere${failedDeliveries.length === 1 ? "" : "n"} atención.`,
      href: "/events",
      tone: "error",
    });
  }

  const activity: DashboardSummary["activity"] = [
    ...registrationRecords.slice(0, 8).map((registration) => ({
      id: `registration-${registration.id}`,
      initials: initials(registration.participantName),
      action: `${registration.participantName} se registró`,
      subject: registration.eventTitle,
      occurredAt: registration.registeredAt.toISOString(),
      href: `/events/${registration.eventSlug}`,
    })),
    ...eventRecords.map((event) => {
      const wasUpdated =
        event.updatedAt.getTime() - event.createdAt.getTime() > 2_000;
      return {
        id: `event-${event.id}`,
        initials: initials(event.creatorName),
        action: `${event.creatorName} ${wasUpdated ? "actualizó" : "creó"} un evento`,
        subject: event.title,
        occurredAt: (wasUpdated ? event.updatedAt : event.createdAt).toISOString(),
        href: `/events/${event.slug}`,
      };
    }),
    ...brandRecords.map((brand) => {
      const actor = brand.updaterName ?? "El equipo";
      return {
        id: `brand-${brand.id}`,
        initials: initials(actor),
        action: `${actor} actualizó la marca`,
        subject: brand.organizationName,
        occurredAt: brand.updatedAt.toISOString(),
        href: "/brand",
      };
    }),
    ...teamRecords.map((member) => ({
      id: `team-${member.id}`,
      initials: initials(member.name),
      action: `${member.name} se incorporó al equipo`,
      subject:
        member.role === "administrator" ? "Administrador" : "Organizador",
      occurredAt: member.createdAt.toISOString(),
      href: "/team",
    })),
  ]
    .sort(
      (first, second) =>
        new Date(second.occurredAt).getTime() -
        new Date(first.occurredAt).getTime(),
    )
    .slice(0, 8);

  const dashboardIntegrations = integrationRecords.filter(
    (
      integration,
    ): integration is (typeof integrationRecords)[number] & {
      provider: "zoom" | "amazon_ivs";
    } =>
      integration.provider === "zoom" ||
      integration.provider === "amazon_ivs",
  );

  return {
    generatedAt: now.toISOString(),
    metrics: {
      events: eventRecords.length,
      registrations: activeRegistrations.length,
      attendanceRate: confirmed
        ? Math.round((attended / confirmed) * 100)
        : 0,
      participationRate: activeRegistrations.length
        ? Math.round(
            (engagedRegistrationIds.size / activeRegistrations.length) * 100,
          )
        : 0,
    },
    events: currentEvents.slice(0, 3).map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      format: event.format,
      status: event.status,
      startsAt: event.startsAt.toISOString(),
      registrations: eventRegistrationCounts.get(event.id) ?? 0,
      streamingReady: readyEventIds.has(event.id),
    })),
    integrations: dashboardIntegrations.map((integration) => ({
      provider: integration.provider,
      status: integration.status,
      accountLabel: integration.accountLabel,
    })),
    notifications: notifications.slice(0, 6),
    notificationCount: notifications.length,
    activity,
  };
}
