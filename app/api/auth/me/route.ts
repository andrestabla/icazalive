import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getPasswordAgeStatus } from "@/lib/password-policy";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const [record] = await getDb()
    .select({
      passwordChangedAt: users.passwordChangedAt,
      createdAt: users.createdAt,
      timezone: users.timezone,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const passwordStatus = record
    ? getPasswordAgeStatus(record.passwordChangedAt, record.createdAt)
    : null;

  return NextResponse.json(
    { data: { ...user, passwordStatus, timezone: record?.timezone ?? null } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
