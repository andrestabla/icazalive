import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { eventRegistrationFields, events } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import {
  createRegistrationFieldKey,
  normalizeFieldOptions,
  REGISTRATION_FIELD_TYPES,
  type RegistrationFieldType,
} from "@/lib/registration-fields";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

async function resolveStaffEvent(slug: string) {
  const currentUser = await requireApiUser();
  if (!currentUser) {
    return {
      error: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (currentUser.role === "participant") {
    return {
      error: NextResponse.json({ error: "No autorizado." }, { status: 403 }),
    };
  }
  const [event] = await getDb()
    .select({ id: events.id, title: events.title, slug: events.slug })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) {
    return {
      error: NextResponse.json(
        { error: "Evento no encontrado." },
        { status: 404 },
      ),
    };
  }
  return { currentUser, event };
}

export async function GET(_: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveStaffEvent(slug);
  if ("error" in resolved) return resolved.error;

  const data = await getDb()
    .select()
    .from(eventRegistrationFields)
    .where(eq(eventRegistrationFields.eventId, resolved.event.id))
    .orderBy(
      asc(eventRegistrationFields.position),
      asc(eventRegistrationFields.createdAt),
    );
  return NextResponse.json({ data });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveStaffEvent(slug);
  if ("error" in resolved) return resolved.error;

  const body = (await request.json()) as {
    label?: string;
    type?: RegistrationFieldType;
    placeholder?: string;
    helpText?: string;
    required?: boolean;
    options?: unknown;
  };
  const label = body.label?.trim();
  const type = body.type;
  if (
    !label ||
    label.length < 2 ||
    label.length > 120 ||
    !REGISTRATION_FIELD_TYPES.includes(type as RegistrationFieldType)
  ) {
    return NextResponse.json(
      { error: "Revisa la etiqueta y el tipo del campo." },
      { status: 400 },
    );
  }
  const options = normalizeFieldOptions(type as RegistrationFieldType, body.options);
  if (type === "select" && options.length < 2) {
    return NextResponse.json(
      { error: "Agrega al menos dos opciones para la lista." },
      { status: 400 },
    );
  }

  const [lastField] = await getDb()
    .select({ position: eventRegistrationFields.position })
    .from(eventRegistrationFields)
    .where(eq(eventRegistrationFields.eventId, resolved.event.id))
    .orderBy(desc(eventRegistrationFields.position))
    .limit(1);
  const [created] = await getDb()
    .insert(eventRegistrationFields)
    .values({
      eventId: resolved.event.id,
      fieldKey: createRegistrationFieldKey(label),
      label,
      type: type as RegistrationFieldType,
      placeholder: body.placeholder?.trim().slice(0, 180) || null,
      helpText: body.helpText?.trim().slice(0, 300) || null,
      required: body.required === true,
      options,
      position: (lastField?.position ?? -1) + 1,
    })
    .returning();

  await writeAuditLog({
    actor: resolved.currentUser,
    action: "registration.field.created",
    resourceType: "registration",
    resourceId: created.id,
    summary: `Campo “${created.label}” agregado al registro de “${resolved.event.title}”.`,
    details: {
      eventId: resolved.event.id,
      type: created.type,
      required: created.required,
    },
    request,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveStaffEvent(slug);
  if ("error" in resolved) return resolved.error;

  const body = (await request.json()) as {
    id?: string;
    label?: string;
    placeholder?: string | null;
    helpText?: string | null;
    required?: boolean;
    active?: boolean;
    options?: unknown;
  };
  if (!body.id) {
    return NextResponse.json({ error: "Campo no válido." }, { status: 400 });
  }
  const [current] = await getDb()
    .select()
    .from(eventRegistrationFields)
    .where(
      and(
        eq(eventRegistrationFields.id, body.id),
        eq(eventRegistrationFields.eventId, resolved.event.id),
      ),
    )
    .limit(1);
  if (!current) {
    return NextResponse.json(
      { error: "Campo no encontrado." },
      { status: 404 },
    );
  }

  const changes: {
    label?: string;
    placeholder?: string | null;
    helpText?: string | null;
    required?: boolean;
    active?: boolean;
    options?: string[];
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (body.label !== undefined) {
    const label = body.label.trim();
    if (label.length < 2 || label.length > 120) {
      return NextResponse.json(
        { error: "La etiqueta del campo no es válida." },
        { status: 400 },
      );
    }
    changes.label = label;
  }
  if (body.placeholder !== undefined) {
    changes.placeholder = body.placeholder?.trim().slice(0, 180) || null;
  }
  if (body.helpText !== undefined) {
    changes.helpText = body.helpText?.trim().slice(0, 300) || null;
  }
  if (body.required !== undefined) changes.required = body.required === true;
  if (body.active !== undefined) changes.active = body.active === true;
  if (body.options !== undefined) {
    const options = normalizeFieldOptions(current.type, body.options);
    if (current.type === "select" && options.length < 2) {
      return NextResponse.json(
        { error: "Agrega al menos dos opciones para la lista." },
        { status: 400 },
      );
    }
    changes.options = options;
  }

  const [updated] = await getDb()
    .update(eventRegistrationFields)
    .set(changes)
    .where(eq(eventRegistrationFields.id, current.id))
    .returning();
  await writeAuditLog({
    actor: resolved.currentUser,
    action: "registration.field.updated",
    resourceType: "registration",
    resourceId: updated.id,
    summary: `Campo “${updated.label}” actualizado.`,
    details: {
      eventId: resolved.event.id,
      active: updated.active,
      required: updated.required,
    },
    request,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await resolveStaffEvent(slug);
  if ("error" in resolved) return resolved.error;
  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Campo no válido." }, { status: 400 });
  }
  const [deleted] = await getDb()
    .delete(eventRegistrationFields)
    .where(
      and(
        eq(eventRegistrationFields.id, body.id),
        eq(eventRegistrationFields.eventId, resolved.event.id),
      ),
    )
    .returning();
  if (!deleted) {
    return NextResponse.json(
      { error: "Campo no encontrado." },
      { status: 404 },
    );
  }
  await writeAuditLog({
    actor: resolved.currentUser,
    action: "registration.field.deleted",
    resourceType: "registration",
    resourceId: deleted.id,
    summary: `Campo “${deleted.label}” eliminado del formulario.`,
    details: { eventId: resolved.event.id },
    request,
  });
  return NextResponse.json({ data: { id: deleted.id } });
}
