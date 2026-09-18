import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requirePageUser } from "@/lib/auth";
import { normalizeLocale } from "@/lib/i18n/locale";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";
import ProfileEditor from "./profile-editor";
import "./profile.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi perfil — Icaza Jammoul Live",
};

function formatDate(value: Date | null) {
  if (!value) return "—";
  const parts = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: PLATFORM_TIMEZONE }).formatToParts(value);
  return parts.map((part) => part.value.replace(/\s+/g, " ")).join("");
}

export default async function ProfilePage() {
  const user = await requirePageUser();
  const [record] = await getDb()
    .select({
      name: users.name,
      email: users.email,
      role: users.role,
      timezone: users.timezone,
      schedulingUrl: users.schedulingUrl,
      locale: users.locale,
      avatarUrl: users.avatarUrl,
      avatarSource: users.avatarSource,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <ProfileEditor
      profile={{
        name: record.name,
        email: record.email,
        role: record.role,
        timezone: record.timezone,
        schedulingUrl: record.schedulingUrl,
        locale: normalizeLocale(record.locale),
        avatarUrl: record.avatarUrl,
        avatarSource: record.avatarSource,
        hasPassword: Boolean(record.passwordHash),
        createdAt: formatDate(record.createdAt),
        lastLoginAt: formatDate(record.lastLoginAt),
      }}
    />
  );
}
