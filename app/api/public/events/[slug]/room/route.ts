import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { NextResponse, after } from "next/server";
import { getDb } from "@/db";
import {
  eventChatMessages,
  eventParticipantModeration,
  eventPolls,
  eventQuestions,
  eventReactions,
  eventResources,
  events,
  pollOptions,
  pollVotes,
  questionVotes,
  registrations,
  sessions,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { notifyEventLive } from "@/lib/live-notifications";
import { getCurrentUser } from "@/lib/auth";
import {
  cleanInteractionText,
  findBlockedTerm,
  isAllowedReaction,
} from "@/lib/interaction-moderation";
import {
  getBearerToken,
  resolveRegistrationAccess,
} from "@/lib/registration-access";
import { notifyRoomActivity } from "@/lib/room-events";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

async function resolveViewer(request: Request, slug: string) {
  const token = getBearerToken(request);
  if (token) {
    const access = await resolveRegistrationAccess(token, slug);
    if (access) return { kind: "participant" as const, access };
  }

  const user = await getCurrentUser();
  if (user && user.role !== "participant") {
    return { kind: "preview" as const, user };
  }
  return null;
}

async function getModeration(eventId: string, registrationId: string) {
  const [moderation] = await getDb()
    .select()
    .from(eventParticipantModeration)
    .where(
      and(
        eq(eventParticipantModeration.eventId, eventId),
        eq(eventParticipantModeration.registrationId, registrationId),
      ),
    )
    .limit(1);
  return moderation ?? null;
}

function moderationError(
  moderation: Awaited<ReturnType<typeof getModeration>>,
) {
  if (moderation?.blocked) {
    return "Tu participación fue bloqueada por el equipo de moderación.";
  }
  if (moderation?.mutedUntil && moderation.mutedUntil > new Date()) {
    return `Tu participación está silenciada hasta ${moderation.mutedUntil.toISOString()}.`;
  }
  return null;
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const viewer = await resolveViewer(request, slug);
  if (!viewer) {
    return NextResponse.json(
      { error: "El enlace de acceso no es válido o ya expiró." },
      { status: 401 },
    );
  }

  const db = getDb();
  const [record] = await db
    .select({ event: events, session: sessions })
    .from(events)
    .innerJoin(sessions, eq(sessions.eventId, events.id))
    .where(eq(events.slug, slug))
    .orderBy(sessions.startsAt)
    .limit(1);
  if (!record) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  // Automatización de eventos simulados: al llegar la hora de inicio la sala
  // pasa a EN VIVO y, al terminar el video, el evento queda completado.
  const simulatedReady =
    record.event.format === "simulated" &&
    record.event.recordedVideoPath &&
    (record.event.recordedVideoDurationSeconds ?? 0) > 0;
  if (simulatedReady) {
    const startMs = record.event.startsAt.getTime();
    const endMs =
      startMs + (record.event.recordedVideoDurationSeconds ?? 0) * 1000;
    const nowMs = Date.now();
    let automatedStatus: "live" | "completed" | null = null;
    if (
      nowMs >= startMs &&
      nowMs < endMs &&
      (record.event.status === "registration_open" ||
        record.event.status === "preparing")
    ) {
      automatedStatus = "live";
    } else if (
      nowMs >= endMs &&
      (record.event.status === "live" ||
        record.event.status === "registration_open" ||
        record.event.status === "preparing")
    ) {
      automatedStatus = "completed";
    }
    if (automatedStatus) {
      await db
        .update(events)
        .set({ status: automatedStatus, updatedAt: new Date() })
        .where(eq(events.id, record.event.id));
      record.event.status = automatedStatus;
      if (automatedStatus === "live") {
        after(() => notifyEventLive(record.event.id));
      }
      await writeAuditLog({
        action: `event.simulated.${automatedStatus === "live" ? "started" : "ended"}`,
        resourceType: "event",
        resourceId: record.event.id,
        summary: `Automatización del evento simulado “${record.event.title}”: ${
          automatedStatus === "live" ? "inicio de reproducción" : "finalización"
        }.`,
        request,
      });
    }
  }

  const [
    questions,
    polls,
    attendeeSummary,
    recentMessages,
    resources,
    reactionSummary,
    moderation,
  ] = await Promise.all([
    db
      .select({
        id: eventQuestions.id,
        question: eventQuestions.question,
        status: eventQuestions.status,
        upvotes: eventQuestions.upvotes,
        authorName: sql<string>`coalesce(${users.name}, ${eventQuestions.authorName}, 'Participante')`,
        createdAt: eventQuestions.createdAt,
      })
      .from(eventQuestions)
      .leftJoin(
        registrations,
        eq(eventQuestions.registrationId, registrations.id),
      )
      .leftJoin(users, eq(registrations.participantId, users.id))
      .where(
        and(
          eq(eventQuestions.eventId, record.event.id),
          ne(eventQuestions.status, "dismissed"),
        ),
      )
      .orderBy(desc(eventQuestions.upvotes), desc(eventQuestions.createdAt)),
    db
      .select()
      .from(eventPolls)
      .where(
        and(
          eq(eventPolls.eventId, record.event.id),
          inArray(eventPolls.status, ["open", "closed"]),
        ),
      )
      .orderBy(desc(eventPolls.createdAt)),
    db
      .select({ total: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, record.event.id),
          ne(registrations.status, "cancelled"),
        ),
      ),
    db
      .select({
        id: eventChatMessages.id,
        authorName: eventChatMessages.authorName,
        message: eventChatMessages.message,
        createdAt: eventChatMessages.createdAt,
      })
      .from(eventChatMessages)
      .where(
        and(
          eq(eventChatMessages.eventId, record.event.id),
          eq(eventChatMessages.channel, "public"),
          eq(eventChatMessages.status, "visible"),
        ),
      )
      .orderBy(desc(eventChatMessages.createdAt))
      .limit(100),
    db
      .select({
        id: eventResources.id,
        title: eventResources.title,
        url: eventResources.url,
        kind: eventResources.kind,
        position: eventResources.position,
        createdAt: eventResources.createdAt,
      })
      .from(eventResources)
      .where(
        and(
          eq(eventResources.eventId, record.event.id),
          eq(eventResources.visible, true),
        ),
      )
      .orderBy(asc(eventResources.position), asc(eventResources.createdAt)),
    db
      .select({
        reaction: eventReactions.reaction,
        count: count(eventReactions.id),
      })
      .from(eventReactions)
      .where(eq(eventReactions.eventId, record.event.id))
      .groupBy(eventReactions.reaction),
    viewer.kind === "participant"
      ? getModeration(record.event.id, viewer.access.registrationId)
      : Promise.resolve(null),
  ]);

  const participantQuestionVotes =
    viewer.kind === "participant"
      ? await db
          .select({ questionId: questionVotes.questionId })
          .from(questionVotes)
          .innerJoin(
            eventQuestions,
            eq(questionVotes.questionId, eventQuestions.id),
          )
          .where(
            and(
              eq(questionVotes.registrationId, viewer.access.registrationId),
              eq(eventQuestions.eventId, record.event.id),
            ),
          )
      : [];

  const pollIds = polls.map((poll) => poll.id);
  const [options, participantVotes] = await Promise.all([
    pollIds.length
      ? db
          .select({
            id: pollOptions.id,
            pollId: pollOptions.pollId,
            label: pollOptions.label,
            position: pollOptions.position,
            votes: count(pollVotes.id),
          })
          .from(pollOptions)
          .leftJoin(pollVotes, eq(pollOptions.id, pollVotes.optionId))
          .where(inArray(pollOptions.pollId, pollIds))
          .groupBy(
            pollOptions.id,
            pollOptions.pollId,
            pollOptions.label,
            pollOptions.position,
          )
          .orderBy(pollOptions.position)
      : Promise.resolve([]),
    viewer.kind === "participant" && pollIds.length
      ? db
          .select({
            pollId: pollVotes.pollId,
            optionId: pollVotes.optionId,
          })
          .from(pollVotes)
          .where(
            and(
              eq(pollVotes.registrationId, viewer.access.registrationId),
              inArray(pollVotes.pollId, pollIds),
            ),
          )
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    data: {
      viewer:
        viewer.kind === "participant"
          ? {
              kind: viewer.kind,
              name: viewer.access.participantName,
              email: viewer.access.participantEmail,
            }
          : {
              kind: viewer.kind,
              name: viewer.user.name,
              email: viewer.user.email,
            },
      event: {
        title: record.event.title,
        description: record.event.description,
        status: record.event.status,
        timezone: record.event.timezone,
        startsAt: record.event.startsAt,
        endsAt: record.event.endsAt,
      },
      session: {
        title: record.session.title,
        streamingMode: record.session.streamingMode,
        streamingStatus: record.session.streamingStatus,
        playbackUrl: record.session.playbackUrl,
        zoomJoinUrl: record.session.zoomJoinUrl,
      },
      attendeeCount: attendeeSummary[0]?.total ?? 0,
      simulatedPlayback: simulatedReady
        ? {
            durationSeconds: record.event.recordedVideoDurationSeconds,
            startsAt: record.event.startsAt.toISOString(),
            endsAt: new Date(
              record.event.startsAt.getTime() +
                (record.event.recordedVideoDurationSeconds ?? 0) * 1000,
            ).toISOString(),
            ended:
              Date.now() >=
              record.event.startsAt.getTime() +
                (record.event.recordedVideoDurationSeconds ?? 0) * 1000,
            postEventRedirectUrl: record.event.postEventRedirectUrl,
          }
        : null,
      questions,
      votedQuestionIds: participantQuestionVotes.map((vote) => vote.questionId),
      polls: polls.map((poll) => ({
        ...poll,
        selectedOptionId:
          participantVotes.find((vote) => vote.pollId === poll.id)?.optionId ??
          null,
        options: options.filter((option) => option.pollId === poll.id),
      })),
      messages: [...recentMessages].reverse(),
      resources,
      reactions: reactionSummary,
      moderation: {
        blocked: moderation?.blocked ?? false,
        mutedUntil: moderation?.mutedUntil ?? null,
        reason: moderation?.reason ?? null,
      },
      serverTime: new Date().toISOString(),
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const token = getBearerToken(request);
  const access = token ? await resolveRegistrationAccess(token, slug) : null;
  if (!access) {
    return NextResponse.json(
      { error: "Necesitas un enlace personal para participar." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    action?: "question" | "question_vote" | "vote" | "chat" | "reaction";
    question?: string;
    questionId?: string;
    message?: string;
    reaction?: string;
    pollId?: string;
    optionId?: string;
  };
  const db = getDb();
  const moderation = await getModeration(
    access.eventId,
    access.registrationId,
  );
  const participationError = moderationError(moderation);
  if (
    participationError &&
    body.action !== "vote" &&
    body.action !== "question_vote"
  ) {
    return NextResponse.json({ error: participationError }, { status: 403 });
  }

  if (body.action === "chat") {
    const message = cleanInteractionText(body.message ?? "");
    if (!message || message.length > 500) {
      return NextResponse.json(
        { error: "El mensaje debe tener entre 1 y 500 caracteres." },
        { status: 400 },
      );
    }
    const blockedTerm = findBlockedTerm(message);
    if (blockedTerm) {
      await writeAuditLog({
        actorEmail: access.participantEmail,
        action: "interaction.content.blocked",
        resourceType: "interaction",
        resourceId: access.registrationId,
        outcome: "denied",
        summary: "Mensaje rechazado por el filtro de contenido.",
        details: { eventId: access.eventId, blockedTerm },
        request,
      });
      return NextResponse.json(
        { error: "El mensaje contiene lenguaje no permitido." },
        { status: 422 },
      );
    }
    const [lastMessage] = await db
      .select({
        message: eventChatMessages.message,
        createdAt: eventChatMessages.createdAt,
      })
      .from(eventChatMessages)
      .where(
        and(
          eq(eventChatMessages.eventId, access.eventId),
          eq(eventChatMessages.registrationId, access.registrationId),
          eq(eventChatMessages.channel, "public"),
        ),
      )
      .orderBy(desc(eventChatMessages.createdAt))
      .limit(1);
    if (
      lastMessage &&
      (Date.now() - lastMessage.createdAt.getTime() < 1_500 ||
        (lastMessage.message === message &&
          Date.now() - lastMessage.createdAt.getTime() < 30_000))
    ) {
      return NextResponse.json(
        { error: "Espera un momento antes de enviar otro mensaje." },
        { status: 429 },
      );
    }
    const [created] = await db
      .insert(eventChatMessages)
      .values({
        eventId: access.eventId,
        registrationId: access.registrationId,
        authorName: access.participantName,
        channel: "public",
        message,
      })
      .returning();
    notifyRoomActivity(access.eventId, "chat");
    return NextResponse.json({ data: created }, { status: 201 });
  }

  if (body.action === "reaction") {
    const reaction = body.reaction ?? "";
    if (!isAllowedReaction(reaction)) {
      return NextResponse.json(
        { error: "La reacción no es válida." },
        { status: 400 },
      );
    }
    const [lastReaction] = await db
      .select({ createdAt: eventReactions.createdAt })
      .from(eventReactions)
      .where(
        and(
          eq(eventReactions.eventId, access.eventId),
          eq(eventReactions.registrationId, access.registrationId),
        ),
      )
      .orderBy(desc(eventReactions.createdAt))
      .limit(1);
    if (
      lastReaction &&
      Date.now() - lastReaction.createdAt.getTime() < 750
    ) {
      return NextResponse.json(
        { error: "Espera un instante antes de reaccionar otra vez." },
        { status: 429 },
      );
    }
    const [created] = await db
      .insert(eventReactions)
      .values({
        eventId: access.eventId,
        registrationId: access.registrationId,
        reaction,
      })
      .returning();
    notifyRoomActivity(access.eventId, "reaction");
    return NextResponse.json({ data: created }, { status: 201 });
  }

  if (body.action === "question") {
    const question = cleanInteractionText(body.question ?? "");
    if (!question || question.length < 5 || question.length > 500) {
      return NextResponse.json(
        { error: "La pregunta debe tener entre 5 y 500 caracteres." },
        { status: 400 },
      );
    }
    if (findBlockedTerm(question)) {
      return NextResponse.json(
        { error: "La pregunta contiene lenguaje no permitido." },
        { status: 422 },
      );
    }
    const [created] = await db
      .insert(eventQuestions)
      .values({
        eventId: access.eventId,
        registrationId: access.registrationId,
        question,
      })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      return NextResponse.json(
        { error: "Ya enviaste esa pregunta." },
        { status: 409 },
      );
    }
    notifyRoomActivity(access.eventId, "question");
    return NextResponse.json({ data: created }, { status: 201 });
  }

  if (body.action === "question_vote" && body.questionId) {
    const [question] = await db
      .select({ id: eventQuestions.id })
      .from(eventQuestions)
      .where(
        and(
          eq(eventQuestions.id, body.questionId),
          eq(eventQuestions.eventId, access.eventId),
          ne(eventQuestions.status, "dismissed"),
        ),
      )
      .limit(1);
    if (!question) {
      return NextResponse.json(
        { error: "La pregunta no existe o fue descartada." },
        { status: 404 },
      );
    }

    const [inserted] = await db
      .insert(questionVotes)
      .values({
        questionId: question.id,
        registrationId: access.registrationId,
      })
      .onConflictDoNothing()
      .returning({ id: questionVotes.id });

    if (!inserted) {
      // Voto duplicado: se interpreta como retiro del voto (toggle).
      await db
        .delete(questionVotes)
        .where(
          and(
            eq(questionVotes.questionId, question.id),
            eq(questionVotes.registrationId, access.registrationId),
          ),
        );
    }

    const [updated] = await db
      .update(eventQuestions)
      .set({
        upvotes: sql<number>`(
          select count(*)::int from question_votes
          where question_votes.question_id = ${question.id}
        )`,
        updatedAt: new Date(),
      })
      .where(eq(eventQuestions.id, question.id))
      .returning({ id: eventQuestions.id, upvotes: eventQuestions.upvotes });

    notifyRoomActivity(access.eventId, "question_vote");
    return NextResponse.json({
      data: {
        questionId: updated.id,
        upvotes: updated.upvotes,
        voted: Boolean(inserted),
      },
    });
  }

  if (body.action === "vote" && body.pollId && body.optionId) {
    const [validOption] = await db
      .select({ pollId: eventPolls.id, optionId: pollOptions.id })
      .from(eventPolls)
      .innerJoin(pollOptions, eq(pollOptions.pollId, eventPolls.id))
      .where(
        and(
          eq(eventPolls.id, body.pollId),
          eq(eventPolls.eventId, access.eventId),
          eq(eventPolls.status, "open"),
          eq(pollOptions.id, body.optionId),
        ),
      )
      .limit(1);
    if (!validOption) {
      return NextResponse.json(
        { error: "La encuesta ya cerró o la opción no es válida." },
        { status: 409 },
      );
    }

    const [vote] = await db
      .insert(pollVotes)
      .values({
        pollId: validOption.pollId,
        optionId: validOption.optionId,
        registrationId: access.registrationId,
      })
      .onConflictDoUpdate({
        target: [pollVotes.pollId, pollVotes.registrationId],
        set: {
          optionId: validOption.optionId,
          createdAt: new Date(),
        },
      })
      .returning();
    notifyRoomActivity(access.eventId, "poll_vote");
    return NextResponse.json({ data: vote });
  }

  return NextResponse.json(
    { error: "La acción solicitada no es válida." },
    { status: 400 },
  );
}
