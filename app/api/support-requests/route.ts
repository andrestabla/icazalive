import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { supportRequests } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import type { HelpLocale } from "@/lib/help-content";

export const runtime = "nodejs";

const languages: HelpLocale[] = ["es", "en", "fr"];
const categories = [
  "technical",
  "event",
  "account",
  "integration",
  "billing",
  "privacy",
  "other",
] as const;

function cleanText(value: unknown, minLength: number, maxLength: number) {
  if (typeof value !== "string") throw new Error("invalid");
  const cleaned = value.trim().replace(/\r\n/g, "\n");
  if (cleaned.length < minLength || cleaned.length > maxLength) {
    throw new Error("invalid");
  }
  return cleaned;
}

function cleanOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  return cleanText(value, 1, maxLength);
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("invalid");
  }
  return email;
}

function cleanOptionalUrl(value: unknown) {
  const candidate = cleanOptionalText(value, 500);
  if (!candidate) return null;
  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("invalid");
  }
  return url.toString();
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role !== "administrator") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const records = await getDb()
    .select()
    .from(supportRequests)
    .orderBy(desc(supportRequests.createdAt))
    .limit(100);
  return NextResponse.json(
    { data: records },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    language?: HelpLocale;
    category?: (typeof categories)[number];
    subject?: string;
    description?: string;
    eventTitle?: string | null;
    eventDate?: string | null;
    eventUrl?: string | null;
    affectedEmail?: string | null;
    screenshotUrl?: string | null;
    consent?: boolean;
  };

  if (
    !body.language ||
    !languages.includes(body.language) ||
    !body.category ||
    !categories.includes(body.category) ||
    body.consent !== true
  ) {
    return NextResponse.json(
      { error: "Completa la categoría, el idioma y el consentimiento." },
      { status: 400 },
    );
  }

  let requesterName: string;
  let requesterEmail: string;
  let subject: string;
  let description: string;
  let eventTitle: string | null;
  let eventUrl: string | null;
  let affectedEmail: string | null;
  let screenshotUrl: string | null;
  let eventDate: Date | null = null;
  try {
    requesterName = cleanText(body.name, 2, 100);
    requesterEmail = cleanEmail(body.email);
    subject = cleanText(body.subject, 5, 180);
    description = cleanText(body.description, 20, 5000);
    eventTitle = cleanOptionalText(body.eventTitle, 180);
    eventUrl = cleanOptionalUrl(body.eventUrl);
    affectedEmail = body.affectedEmail
      ? cleanEmail(body.affectedEmail)
      : null;
    screenshotUrl = cleanOptionalUrl(body.screenshotUrl);
    if (body.eventDate) {
      eventDate = new Date(body.eventDate);
      if (Number.isNaN(eventDate.getTime())) throw new Error("invalid");
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "Revisa tus datos, la descripción y los enlaces proporcionados.",
      },
      { status: 400 },
    );
  }

  const db = getDb();
  const [duplicate] = await db
    .select({ id: supportRequests.id })
    .from(supportRequests)
    .where(
      and(
        eq(supportRequests.requesterEmail, requesterEmail),
        eq(supportRequests.subject, subject),
        inArray(supportRequests.status, ["new", "in_progress"]),
        gt(
          supportRequests.createdAt,
          new Date(Date.now() - 24 * 60 * 60 * 1000),
        ),
      ),
    )
    .limit(1);
  if (duplicate) {
    return NextResponse.json(
      {
        error:
          "Ya existe una solicitud reciente con el mismo asunto. Usa ese número para dar seguimiento y evita duplicados.",
        duplicateId: duplicate.id,
      },
      { status: 409 },
    );
  }

  const now = new Date();
  const [created] = await db
    .insert(supportRequests)
    .values({
      requesterUserId: currentUser?.id ?? null,
      requesterName,
      requesterEmail,
      language: body.language,
      category: body.category,
      subject,
      description,
      eventTitle,
      eventDate,
      eventUrl,
      affectedEmail,
      screenshotUrl,
      consentAcceptedAt: now,
      retentionUntil: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: supportRequests.id,
      status: supportRequests.status,
      createdAt: supportRequests.createdAt,
    });

  await writeAuditLog({
    actor: currentUser,
    actorEmail: requesterEmail,
    action: "support.request.created",
    resourceType: "support_request",
    resourceId: created.id,
    summary: "Nueva solicitud de soporte registrada.",
    details: {
      category: body.category,
      language: body.language,
      eventProvided: Boolean(eventTitle),
      screenshotProvided: Boolean(screenshotUrl),
    },
    request,
  });

  return NextResponse.json(
    {
      data: {
        ...created,
        supportEmail:
          process.env.SUPPORT_EMAIL ?? "soporte@icazalive.local",
        serviceHours:
          process.env.SUPPORT_HOURS ??
          "Lunes a viernes · 08:00–18:00 (hora de Miami)",
      },
    },
    { status: 201 },
  );
}
