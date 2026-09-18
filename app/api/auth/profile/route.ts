import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";
import { fileUrl } from "@/lib/uploads";

export const runtime = "nodejs";

// Perfil propio: nombre, idioma de la interfaz y foto. El correo lo cambia un
// administrador desde Equipo (afecta el inicio de sesión).
export async function PATCH(request: Request) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    locale?: string;
    avatarKey?: string;
    removeAvatar?: boolean;
  };
  const changes: Partial<typeof users.$inferInsert> = {};
  const details: Record<string, string | null> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "El nombre debe tener entre 2 y 100 caracteres." }, { status: 400 });
    }
    changes.name = name;
    details.name = name;
  }
  if (body.locale !== undefined) {
    if (body.locale !== "es" && body.locale !== "en") {
      return NextResponse.json({ error: "Idioma no disponible." }, { status: 400 });
    }
    changes.locale = body.locale;
    details.locale = body.locale;
  }
  if (body.avatarKey !== undefined) {
    if (typeof body.avatarKey !== "string" || !/^avatars\/[A-Za-z0-9._-]{1,160}$/.test(body.avatarKey)) {
      return NextResponse.json({ error: "La foto no es válida." }, { status: 400 });
    }
    changes.avatarUrl = fileUrl(body.avatarKey);
    changes.avatarSource = "upload";
    details.avatar = changes.avatarUrl ?? null;
  }
  if (body.removeAvatar) {
    changes.avatarUrl = null;
    changes.avatarSource = null;
    details.avatar = null;
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "No hay cambios para guardar." }, { status: 400 });
  }

  const [updated] = await getDb()
    .update(users)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning({
      name: users.name,
      locale: users.locale,
      avatarUrl: users.avatarUrl,
      avatarSource: users.avatarSource,
    });

  await writeAuditLog({
    actor: user,
    action: "auth.profile.updated",
    resourceType: "authentication",
    resourceId: user.id,
    summary: "Perfil actualizado.",
    details,
    request,
  });

  const response = NextResponse.json({ data: { ...updated, locale: normalizeLocale(updated.locale) } });
  if (changes.locale !== undefined) {
    response.cookies.set(LOCALE_COOKIE, normalizeLocale(changes.locale), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
  }
  return response;
}
