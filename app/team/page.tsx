import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requirePageUser } from "@/lib/auth";
import TeamManager from "./team-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Equipo — Icaza Live",
};

export default async function TeamPage() {
  const currentUser = await requirePageUser();
  const members = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(inArray(users.role, ["administrator", "organizer"]))
    .orderBy(users.createdAt);

  return (
    <TeamManager
      currentUserId={currentUser.id}
      serverTime={new Date().toISOString()}
      initialMembers={members.map((member) => ({
        ...member,
        lockedUntil: member.lockedUntil?.toISOString() ?? null,
        lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
      }))}
    />
  );
}
