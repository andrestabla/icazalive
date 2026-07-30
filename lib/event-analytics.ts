import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  communicationDeliveries,
  eventPolls,
  eventQuestions,
  pollOptions,
  pollVotes,
  registrationAccessTokens,
  registrations,
  sessions,
} from "@/db/schema";

export type EventAnalytics = {
  registration: {
    total: number;
    registered: number;
    confirmed: number;
    attended: number;
    cancelled: number;
    roomVisitors: number;
    attendanceRate: number;
  };
  interaction: {
    questions: number;
    pendingQuestions: number;
    answeredQuestions: number;
    polls: number;
    openPolls: number;
    votes: number;
    uniqueParticipants: number;
    participationRate: number;
  };
  communications: {
    total: number;
    queued: number;
    scheduled: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
  streaming: {
    sessions: number;
    ready: number;
    live: number;
  };
  registrationTimeline: { date: string; total: number }[];
  polls: {
    id: string;
    question: string;
    status: "draft" | "open" | "closed";
    totalVotes: number;
    options: { id: string; label: string; votes: number; percentage: number }[];
  }[];
};

export async function getEventAnalytics(
  eventId: string,
): Promise<EventAnalytics> {
  const db = getDb();
  const [
    registrationRecords,
    questionRecords,
    pollRecords,
    deliveryRecords,
    sessionRecords,
    visitorRecords,
  ] = await Promise.all([
    db
      .select({
        id: registrations.id,
        status: registrations.status,
        registeredAt: registrations.registeredAt,
      })
      .from(registrations)
      .where(eq(registrations.eventId, eventId)),
    db
      .select({
        status: eventQuestions.status,
        registrationId: eventQuestions.registrationId,
      })
      .from(eventQuestions)
      .where(eq(eventQuestions.eventId, eventId)),
    db
      .select()
      .from(eventPolls)
      .where(eq(eventPolls.eventId, eventId)),
    db
      .select({ status: communicationDeliveries.status })
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.eventId, eventId)),
    db
      .select({ status: sessions.streamingStatus })
      .from(sessions)
      .where(eq(sessions.eventId, eventId)),
    db
      .select({
        registrationId: registrationAccessTokens.registrationId,
        lastUsedAt: registrationAccessTokens.lastUsedAt,
      })
      .from(registrationAccessTokens)
      .innerJoin(
        registrations,
        eq(registrationAccessTokens.registrationId, registrations.id),
      )
      .where(eq(registrations.eventId, eventId)),
  ]);

  const pollIds = pollRecords.map((poll) => poll.id);
  const [optionRecords, voteRecords] = await Promise.all([
    pollIds.length
      ? db
          .select()
          .from(pollOptions)
          .where(inArray(pollOptions.pollId, pollIds))
          .orderBy(pollOptions.position)
      : Promise.resolve([]),
    pollIds.length
      ? db
          .select({
            pollId: pollVotes.pollId,
            optionId: pollVotes.optionId,
            registrationId: pollVotes.registrationId,
          })
          .from(pollVotes)
          .where(inArray(pollVotes.pollId, pollIds))
      : Promise.resolve([]),
  ]);

  const statusTotal = <
    T extends { status: string },
  >(
    records: T[],
    status: string,
  ) => records.filter((record) => record.status === status).length;
  const activeRegistrations = registrationRecords.filter(
    (registration) => registration.status !== "cancelled",
  );
  const confirmed =
    statusTotal(registrationRecords, "confirmed") +
    statusTotal(registrationRecords, "attended");
  const attended = statusTotal(registrationRecords, "attended");
  const engagedRegistrationIds = new Set(
    [
      ...questionRecords.map((question) => question.registrationId),
      ...voteRecords.map((vote) => vote.registrationId),
    ].filter((id): id is string => Boolean(id)),
  );
  const registrationTimeline = new Map<string, number>();
  for (const registration of activeRegistrations) {
    const date = registration.registeredAt.toISOString().slice(0, 10);
    registrationTimeline.set(date, (registrationTimeline.get(date) ?? 0) + 1);
  }

  return {
    registration: {
      total: activeRegistrations.length,
      registered: statusTotal(registrationRecords, "registered"),
      confirmed,
      attended,
      cancelled: statusTotal(registrationRecords, "cancelled"),
      roomVisitors: visitorRecords.filter((visitor) => visitor.lastUsedAt).length,
      attendanceRate: confirmed ? Math.round((attended / confirmed) * 100) : 0,
    },
    interaction: {
      questions: questionRecords.length,
      pendingQuestions: statusTotal(questionRecords, "pending"),
      answeredQuestions: statusTotal(questionRecords, "answered"),
      polls: pollRecords.length,
      openPolls: statusTotal(pollRecords, "open"),
      votes: voteRecords.length,
      uniqueParticipants: engagedRegistrationIds.size,
      participationRate: activeRegistrations.length
        ? Math.round(
            (engagedRegistrationIds.size / activeRegistrations.length) * 100,
          )
        : 0,
    },
    communications: {
      total: deliveryRecords.length,
      queued: statusTotal(deliveryRecords, "queued"),
      scheduled: statusTotal(deliveryRecords, "scheduled"),
      sent: statusTotal(deliveryRecords, "sent"),
      failed: statusTotal(deliveryRecords, "failed"),
      cancelled: statusTotal(deliveryRecords, "cancelled"),
    },
    streaming: {
      sessions: sessionRecords.length,
      ready: statusTotal(sessionRecords, "ready"),
      live: statusTotal(sessionRecords, "live"),
    },
    registrationTimeline: Array.from(registrationTimeline.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    polls: pollRecords.map((poll) => {
      const options = optionRecords.filter((option) => option.pollId === poll.id);
      const votes = voteRecords.filter((vote) => vote.pollId === poll.id);
      return {
        id: poll.id,
        question: poll.question,
        status: poll.status,
        totalVotes: votes.length,
        options: options.map((option) => {
          const optionVotes = votes.filter(
            (vote) => vote.optionId === option.id,
          ).length;
          return {
            id: option.id,
            label: option.label,
            votes: optionVotes,
            percentage: votes.length
              ? Math.round((optionVotes / votes.length) * 100)
              : 0,
          };
        }),
      };
    }),
  };
}
