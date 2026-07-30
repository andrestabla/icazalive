import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  eventFeedbackResponses,
  events,
  registrations,
  users,
} from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role === "participant") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { slug } = await context.params;
  const db = getDb();
  const [event] = await db
    .select({
      id: events.id,
      feedbackEnabled: events.feedbackEnabled,
      feedbackQuestion: events.feedbackQuestion,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const responses = await db
    .select({
      id: eventFeedbackResponses.id,
      rating: eventFeedbackResponses.rating,
      comment: eventFeedbackResponses.comment,
      createdAt: eventFeedbackResponses.createdAt,
      updatedAt: eventFeedbackResponses.updatedAt,
      participantName: users.name,
      participantEmail: users.email,
    })
    .from(eventFeedbackResponses)
    .innerJoin(
      registrations,
      eq(eventFeedbackResponses.registrationId, registrations.id),
    )
    .innerJoin(users, eq(registrations.participantId, users.id))
    .where(eq(eventFeedbackResponses.eventId, event.id))
    .orderBy(desc(eventFeedbackResponses.updatedAt));

  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: responses.filter((item) => item.rating === rating).length,
  }));
  const total = responses.length;
  const average = total
    ? Math.round(
        (responses.reduce((sum, item) => sum + item.rating, 0) / total) * 10,
      ) / 10
    : null;

  return NextResponse.json({
    data: {
      enabled: event.feedbackEnabled,
      question: event.feedbackQuestion,
      total,
      average,
      distribution,
      responses,
    },
  });
}
