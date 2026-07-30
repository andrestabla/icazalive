import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
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
  registrations,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import {
  cleanInteractionText,
  findBlockedTerm,
} from "@/lib/interaction-moderation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

async function requireStaff() {
  const user = await requireApiUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (user.role === "participant") {
    return {
      error: NextResponse.json({ error: "No autorizado." }, { status: 403 }),
    };
  }
  return { user };
}

async function findEvent(slug: string) {
  const [event] = await getDb()
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  return event;
}

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const event = await findEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const db = getDb();
  const [questions, polls, messages, resources, moderations, reactionSummary] =
    await Promise.all([
      db
        .select({
          id: eventQuestions.id,
          question: eventQuestions.question,
          status: eventQuestions.status,
          upvotes: eventQuestions.upvotes,
          authorName: sql<string>`coalesce(${users.name}, ${eventQuestions.authorName}, 'Participante')`,
          authorEmail: users.email,
          answeredAt: eventQuestions.answeredAt,
          createdAt: eventQuestions.createdAt,
          updatedAt: eventQuestions.updatedAt,
        })
        .from(eventQuestions)
        .leftJoin(
          registrations,
          eq(eventQuestions.registrationId, registrations.id),
        )
        .leftJoin(users, eq(registrations.participantId, users.id))
        .where(eq(eventQuestions.eventId, event.id))
        .orderBy(desc(eventQuestions.upvotes), desc(eventQuestions.createdAt)),
      db
        .select()
        .from(eventPolls)
        .where(eq(eventPolls.eventId, event.id))
        .orderBy(desc(eventPolls.createdAt)),
      db
        .select({
          id: eventChatMessages.id,
          registrationId: eventChatMessages.registrationId,
          authorUserId: eventChatMessages.authorUserId,
          authorName: eventChatMessages.authorName,
          authorEmail: users.email,
          channel: eventChatMessages.channel,
          message: eventChatMessages.message,
          status: eventChatMessages.status,
          removedAt: eventChatMessages.removedAt,
          createdAt: eventChatMessages.createdAt,
        })
        .from(eventChatMessages)
        .leftJoin(
          registrations,
          eq(eventChatMessages.registrationId, registrations.id),
        )
        .leftJoin(users, eq(registrations.participantId, users.id))
        .where(eq(eventChatMessages.eventId, event.id))
        .orderBy(desc(eventChatMessages.createdAt))
        .limit(200),
      db
        .select()
        .from(eventResources)
        .where(eq(eventResources.eventId, event.id))
        .orderBy(asc(eventResources.position), desc(eventResources.createdAt)),
      db
        .select({
          id: eventParticipantModeration.id,
          registrationId: eventParticipantModeration.registrationId,
          participantName: users.name,
          participantEmail: users.email,
          mutedUntil: eventParticipantModeration.mutedUntil,
          blocked: eventParticipantModeration.blocked,
          reason: eventParticipantModeration.reason,
          updatedAt: eventParticipantModeration.updatedAt,
        })
        .from(eventParticipantModeration)
        .innerJoin(
          registrations,
          eq(eventParticipantModeration.registrationId, registrations.id),
        )
        .innerJoin(users, eq(registrations.participantId, users.id))
        .where(eq(eventParticipantModeration.eventId, event.id))
        .orderBy(desc(eventParticipantModeration.updatedAt)),
      db
        .select({
          reaction: eventReactions.reaction,
          count: count(eventReactions.id),
        })
        .from(eventReactions)
        .where(eq(eventReactions.eventId, event.id))
        .groupBy(eventReactions.reaction),
    ]);

  const options = polls.length
    ? await db
        .select({
          id: pollOptions.id,
          pollId: pollOptions.pollId,
          label: pollOptions.label,
          position: pollOptions.position,
          votes: count(pollVotes.id),
        })
        .from(pollOptions)
        .leftJoin(pollVotes, eq(pollOptions.id, pollVotes.optionId))
        .where(
          inArray(
            pollOptions.pollId,
            polls.map((poll) => poll.id),
          ),
        )
        .groupBy(
          pollOptions.id,
          pollOptions.pollId,
          pollOptions.label,
          pollOptions.position,
        )
        .orderBy(pollOptions.position)
    : [];

  return NextResponse.json({
    data: {
      questions,
      polls: polls.map((poll) => ({
        ...poll,
        options: options.filter((option) => option.pollId === poll.id),
      })),
      messages,
      resources,
      moderations,
      reactions: reactionSummary,
      serverTime: new Date().toISOString(),
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const event = await findEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const body = (await request.json()) as {
    entity?: "poll" | "message" | "resource";
    question?: string;
    options?: string[];
    anonymous?: boolean;
    channel?: "public" | "backstage";
    message?: string;
    title?: string;
    url?: string;
    kind?: "link" | "file";
  };
  const db = getDb();

  if (body.entity === "message") {
    const message = cleanInteractionText(body.message ?? "");
    const channel = body.channel ?? "backstage";
    if (
      !message ||
      message.length > 500 ||
      !["public", "backstage"].includes(channel)
    ) {
      return NextResponse.json(
        { error: "El mensaje debe tener entre 1 y 500 caracteres." },
        { status: 400 },
      );
    }
    if (findBlockedTerm(message)) {
      return NextResponse.json(
        { error: "El mensaje contiene lenguaje no permitido." },
        { status: 422 },
      );
    }
    const [created] = await db
      .insert(eventChatMessages)
      .values({
        eventId: event.id,
        authorUserId: auth.user.id,
        authorName: auth.user.name,
        channel,
        message,
      })
      .returning();
    await writeAuditLog({
      actor: auth.user,
      action: `interaction.message.${channel}.created`,
      resourceType: "interaction",
      resourceId: created.id,
      summary:
        channel === "backstage"
          ? "Mensaje enviado al canal privado de producción."
          : "Mensaje enviado al chat público.",
      details: { eventId: event.id, channel },
      request,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  }

  if (body.entity === "resource") {
    const title = cleanInteractionText(body.title ?? "");
    const url = body.url?.trim() ?? "";
    const kind = body.kind ?? "link";
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Incluye una URL válida para el recurso." },
        { status: 400 },
      );
    }
    if (
      !title ||
      title.length > 160 ||
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      !["link", "file"].includes(kind)
    ) {
      return NextResponse.json(
        { error: "El recurso requiere título y una URL HTTP o HTTPS." },
        { status: 400 },
      );
    }
    const [positionSummary] = await db
      .select({ total: count() })
      .from(eventResources)
      .where(eq(eventResources.eventId, event.id));
    const [created] = await db
      .insert(eventResources)
      .values({
        eventId: event.id,
        title,
        url: parsedUrl.toString(),
        kind,
        position: positionSummary?.total ?? 0,
        createdBy: auth.user.id,
      })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      return NextResponse.json(
        { error: "Este recurso ya fue agregado al evento." },
        { status: 409 },
      );
    }
    await writeAuditLog({
      actor: auth.user,
      action: "interaction.resource.created",
      resourceType: "interaction",
      resourceId: created.id,
      summary: "Recurso compartido agregado al evento.",
      details: { eventId: event.id, kind },
      request,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  }

  const question = body.question?.trim();
  const options = (body.options ?? [])
    .map((option) => option.trim())
    .filter(Boolean);
  const uniqueOptions = new Set(options.map((option) => option.toLowerCase()));

  if (
    !question ||
    question.length < 5 ||
    question.length > 280 ||
    options.length < 2 ||
    options.length > 6 ||
    uniqueOptions.size !== options.length ||
    options.some((option) => option.length > 120) ||
    (body.anonymous !== undefined && typeof body.anonymous !== "boolean")
  ) {
    return NextResponse.json(
      { error: "Incluye una pregunta y entre 2 y 6 opciones diferentes." },
      { status: 400 },
    );
  }

  const result = await db.transaction(async (transaction) => {
    const [poll] = await transaction
      .insert(eventPolls)
      .values({
        eventId: event.id,
        question,
        anonymous: body.anonymous ?? true,
      })
      .onConflictDoNothing()
      .returning();
    if (!poll) return null;

    const storedOptions = await transaction
      .insert(pollOptions)
      .values(
        options.map((label, position) => ({
          pollId: poll.id,
          label,
          position,
        })),
      )
      .returning();
    return {
      ...poll,
      options: storedOptions.map((option) => ({ ...option, votes: 0 })),
    };
  });

  if (!result) {
    return NextResponse.json(
      { error: "Ya existe una encuesta con esa pregunta." },
      { status: 409 },
    );
  }
  await writeAuditLog({
    actor: auth.user,
    action: "interaction.poll.created",
    resourceType: "interaction",
    resourceId: result.id,
    summary: "Encuesta creada para el evento.",
    details: {
      eventId: event.id,
      anonymous: result.anonymous,
      optionCount: result.options.length,
    },
    request,
  });
  return NextResponse.json({ data: result }, { status: 201 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const { slug } = await context.params;
  const event = await findEvent(slug);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  const body = (await request.json()) as {
    entity?: "question" | "poll" | "chat" | "moderation" | "resource";
    id?: string;
    registrationId?: string;
    status?: "pending" | "answered" | "dismissed";
    action?:
      | "open"
      | "close"
      | "remove"
      | "mute"
      | "unmute"
      | "block"
      | "unblock"
      | "show"
      | "hide";
    reason?: string;
  };
  const db = getDb();
  const now = new Date();

  if (body.entity === "chat" && body.id && body.action === "remove") {
    const [message] = await db
      .update(eventChatMessages)
      .set({
        status: "removed",
        removedBy: auth.user.id,
        removedAt: now,
      })
      .where(
        and(
          eq(eventChatMessages.id, body.id),
          eq(eventChatMessages.eventId, event.id),
        ),
      )
      .returning();
    if (!message) {
      return NextResponse.json(
        { error: "Mensaje no encontrado." },
        { status: 404 },
      );
    }
    await writeAuditLog({
      actor: auth.user,
      action: "interaction.chat.removed",
      resourceType: "interaction",
      resourceId: message.id,
      summary: "Mensaje retirado por moderación.",
      details: { eventId: event.id, channel: message.channel },
      request,
    });
    return NextResponse.json({ data: message });
  }

  if (body.entity === "moderation" && body.registrationId) {
    const allowedActions = ["mute", "unmute", "block", "unblock"] as const;
    if (
      !body.action ||
      !allowedActions.includes(
        body.action as (typeof allowedActions)[number],
      )
    ) {
      return NextResponse.json(
        { error: "La acción de moderación no es válida." },
        { status: 400 },
      );
    }
    const [participant] = await db
      .select({ id: registrations.id, email: users.email })
      .from(registrations)
      .innerJoin(users, eq(registrations.participantId, users.id))
      .where(
        and(
          eq(registrations.id, body.registrationId),
          eq(registrations.eventId, event.id),
        ),
      )
      .limit(1);
    if (!participant) {
      return NextResponse.json(
        { error: "Participante no encontrado." },
        { status: 404 },
      );
    }
    const mutedUntil =
      body.action === "mute"
        ? new Date(now.getTime() + 15 * 60_000)
        : body.action === "unmute"
          ? null
          : undefined;
    const blocked =
      body.action === "block"
        ? true
        : body.action === "unblock"
          ? false
          : undefined;
    const [moderation] = await db
      .insert(eventParticipantModeration)
      .values({
        eventId: event.id,
        registrationId: participant.id,
        mutedUntil: mutedUntil ?? null,
        blocked: blocked ?? false,
        reason: cleanInteractionText(body.reason ?? "") || null,
        updatedBy: auth.user.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          eventParticipantModeration.eventId,
          eventParticipantModeration.registrationId,
        ],
        set: {
          mutedUntil,
          blocked,
          reason: cleanInteractionText(body.reason ?? "") || null,
          updatedBy: auth.user.id,
          updatedAt: now,
        },
      })
      .returning();
    await writeAuditLog({
      actor: auth.user,
      action: `interaction.participant.${body.action}`,
      resourceType: "interaction",
      resourceId: participant.id,
      summary: `Moderación aplicada: ${body.action}.`,
      details: {
        eventId: event.id,
        participantEmail: participant.email,
        action: body.action,
      },
      request,
    });
    return NextResponse.json({ data: moderation });
  }

  if (
    body.entity === "resource" &&
    body.id &&
    (body.action === "show" || body.action === "hide")
  ) {
    const [resource] = await db
      .update(eventResources)
      .set({
        visible: body.action === "show",
        updatedAt: now,
      })
      .where(
        and(
          eq(eventResources.id, body.id),
          eq(eventResources.eventId, event.id),
        ),
      )
      .returning();
    if (!resource) {
      return NextResponse.json(
        { error: "Recurso no encontrado." },
        { status: 404 },
      );
    }
    await writeAuditLog({
      actor: auth.user,
      action: `interaction.resource.${body.action === "show" ? "shown" : "hidden"}`,
      resourceType: "interaction",
      resourceId: resource.id,
      summary: `Recurso ${body.action === "show" ? "publicado" : "ocultado"}.`,
      details: { eventId: event.id },
      request,
    });
    return NextResponse.json({ data: resource });
  }

  if (!body.id || (body.entity !== "question" && body.entity !== "poll")) {
    return NextResponse.json(
      { error: "Selecciona un elemento para actualizar." },
      { status: 400 },
    );
  }

  if (body.entity === "question") {
    const allowedStatuses = ["pending", "answered", "dismissed"] as const;
    if (
      !body.status ||
      !allowedStatuses.includes(body.status)
    ) {
      return NextResponse.json(
        { error: "El estado de la pregunta no es válido." },
        { status: 400 },
      );
    }
    const [question] = await db
      .update(eventQuestions)
      .set({
        status: body.status,
        answeredAt: body.status === "answered" ? now : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(eventQuestions.id, body.id),
          eq(eventQuestions.eventId, event.id),
        ),
      )
      .returning();
    if (!question) {
      return NextResponse.json(
        { error: "Pregunta no encontrada." },
        { status: 404 },
      );
    }
    await writeAuditLog({
      actor: auth.user,
      action: "interaction.question.moderated",
      resourceType: "interaction",
      resourceId: question.id,
      summary: `Pregunta marcada como ${question.status}.`,
      details: { eventId: event.id, entity: "question" },
      request,
    });
    return NextResponse.json({ data: question });
  }

  if (body.action !== "open" && body.action !== "close") {
    return NextResponse.json(
      { error: "La acción de la encuesta no es válida." },
      { status: 400 },
    );
  }
  const [poll] = await db
    .update(eventPolls)
    .set({
      status: body.action === "open" ? "open" : "closed",
      launchedAt: body.action === "open" ? now : undefined,
      closedAt: body.action === "close" ? now : null,
      updatedAt: now,
    })
    .where(
      and(eq(eventPolls.id, body.id), eq(eventPolls.eventId, event.id)),
    )
    .returning();
  if (!poll) {
    return NextResponse.json(
      { error: "Encuesta no encontrada." },
      { status: 404 },
    );
  }
  await writeAuditLog({
    actor: auth.user,
    action: `interaction.poll.${body.action === "open" ? "opened" : "closed"}`,
    resourceType: "interaction",
    resourceId: poll.id,
    summary: `Encuesta ${body.action === "open" ? "abierta" : "cerrada"}.`,
    details: { eventId: event.id, entity: "poll" },
    request,
  });
  return NextResponse.json({ data: poll });
}
