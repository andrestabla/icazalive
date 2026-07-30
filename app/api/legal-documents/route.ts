import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { legalDocuments } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import {
  getPublishedLegalDocuments,
  type LegalDocumentKind,
} from "@/lib/privacy";

export const runtime = "nodejs";

function cleanText(value: unknown, minLength: number, maxLength: number) {
  if (typeof value !== "string") throw new Error("invalid");
  const cleaned = value.trim().replace(/\r\n/g, "\n");
  if (cleaned.length < minLength || cleaned.length > maxLength) {
    throw new Error("invalid");
  }
  return cleaned;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("all") === "1") {
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (user.role !== "administrator") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }
    const data = await getDb()
      .select()
      .from(legalDocuments)
      .orderBy(legalDocuments.type, desc(legalDocuments.version));
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { data: await getPublishedLegalDocuments() },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role !== "administrator") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    type?: LegalDocumentKind;
    title?: string;
    summary?: string;
    content?: string;
    publish?: boolean;
  };
  if (body.type !== "privacy" && body.type !== "terms") {
    return NextResponse.json(
      { error: "Selecciona un tipo de documento válido." },
      { status: 400 },
    );
  }

  let values: { title: string; summary: string; content: string };
  try {
    values = {
      title: cleanText(body.title, 5, 180),
      summary: cleanText(body.summary, 20, 500),
      content: cleanText(body.content, 100, 20_000),
    };
  } catch {
    return NextResponse.json(
      { error: "Revisa el título, el resumen y el contenido del documento." },
      { status: 400 },
    );
  }

  const now = new Date();
  const document = await getDb().transaction(async (transaction) => {
    const [latest] = await transaction
      .select({ version: legalDocuments.version })
      .from(legalDocuments)
      .where(eq(legalDocuments.type, body.type!))
      .orderBy(desc(legalDocuments.version))
      .limit(1);

    if (body.publish !== false) {
      await transaction
        .update(legalDocuments)
        .set({ status: "archived", updatedAt: now })
        .where(
          and(
            eq(legalDocuments.type, body.type!),
            eq(legalDocuments.status, "published"),
          ),
        );
    }

    const [created] = await transaction
      .insert(legalDocuments)
      .values({
        type: body.type!,
        version: (latest?.version ?? 0) + 1,
        ...values,
        status: body.publish === false ? "draft" : "published",
        publishedAt: body.publish === false ? null : now,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  });

  await writeAuditLog({
    actor: user,
    action: "privacy.document.published",
    resourceType: "legal_document",
    resourceId: document.id,
    summary: `${body.type === "privacy" ? "Política de privacidad" : "Términos de uso"} versión ${document.version} guardada.`,
    details: {
      type: body.type,
      version: document.version,
      status: document.status,
    },
    request,
  });

  return NextResponse.json({ data: document }, { status: 201 });
}
