import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { eventFeedbackResponses, events } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  getBearerToken,
  resolveRegistrationAccess,
} from "@/lib/registration-access";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export const DEFAULT_FEEDBACK_QUESTION =
  "¿Cómo calificarías tu experiencia en el evento?";

async function resolveFeedbackContext(request: Request, slug: string) {
  const token =
    getBearerToken(request) ||
    new URL(request.url).searchParams.get("access") ||
    "";
  const access = token
    ? await resolveRegistrationAccess(token, slug)
    : null;
  if (!access) return null;

  const [event] = await getDb()
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      endsAt: events.endsAt,
      feedbackEnabled: events.feedbackEnabled,
      feedbackQuestion: events.feedbackQuestion,
    })
    .from(events)
    .where(eq(events.id, access.eventId))
    .limit(1);
  if (!event) return null;

  const finished =
    event.status === "completed" || event.endsAt.getTime() < Date.now();
  const available =
    event.feedbackEnabled && finished && event.status !== "cancelled";

  return { access, event, available };
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const feedbackContext = await resolveFeedbackContext(request, slug);
  if (!feedbackContext) {
    return NextResponse.json(
      { error: "El enlace de acceso no es válido o ya expiró." },
      { status: 401 },
    );
  }

  const [existing] = await getDb()
    .select({
      rating: eventFeedbackResponses.rating,
      comment: eventFeedbackResponses.comment,
      updatedAt: eventFeedbackResponses.updatedAt,
    })
    .from(eventFeedbackResponses)
    .where(
      and(
        eq(eventFeedbackResponses.eventId, feedbackContext.event.id),
        eq(
          eventFeedbackResponses.registrationId,
          feedbackContext.access.registrationId,
        ),
      ),
    )
    .limit(1);

  return NextResponse.json({
    data: {
      available: feedbackContext.available,
      question:
        feedbackContext.event.feedbackQuestion || DEFAULT_FEEDBACK_QUESTION,
      response: existing ?? null,
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const feedbackContext = await resolveFeedbackContext(request, slug);
  if (!feedbackContext) {
    return NextResponse.json(
      { error: "El enlace de acceso no es válido o ya expiró." },
      { status: 401 },
    );
  }
  if (!feedbackContext.available) {
    return NextResponse.json(
      { error: "La encuesta de satisfacción no está disponible para este evento." },
      { status: 409 },
    );
  }

  const body = (await request.json()) as {
    rating?: number;
    comment?: string;
  };
  if (
    typeof body.rating !== "number" ||
    !Number.isInteger(body.rating) ||
    body.rating < 1 ||
    body.rating > 5
  ) {
    return NextResponse.json(
      { error: "La calificación debe ser un número entero entre 1 y 5." },
      { status: 400 },
    );
  }
  const comment = body.comment?.trim().slice(0, 1000) || null;

  const [saved] = await getDb()
    .insert(eventFeedbackResponses)
    .values({
      eventId: feedbackContext.event.id,
      registrationId: feedbackContext.access.registrationId,
      rating: body.rating,
      comment,
    })
    .onConflictDoUpdate({
      target: [
        eventFeedbackResponses.eventId,
        eventFeedbackResponses.registrationId,
      ],
      set: { rating: body.rating, comment, updatedAt: new Date() },
    })
    .returning({
      rating: eventFeedbackResponses.rating,
      comment: eventFeedbackResponses.comment,
    });

  await writeAuditLog({
    actorEmail: feedbackContext.access.participantEmail,
    action: "event.feedback.submitted",
    resourceType: "event",
    resourceId: feedbackContext.event.id,
    summary: `Feedback registrado para “${feedbackContext.event.title}”.`,
    details: { rating: saved.rating, hasComment: Boolean(saved.comment) },
    request,
  });
  return NextResponse.json({ data: saved });
}
