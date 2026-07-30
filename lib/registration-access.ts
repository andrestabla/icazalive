import { and, eq, gt, ne } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/db";
import {
  events,
  registrationAccessTokens,
  registrations,
  users,
} from "@/db/schema";

export function createRegistrationAccessToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashRegistrationAccessToken(token) };
}

export function hashRegistrationAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export async function resolveRegistrationAccess(
  token: string,
  slug: string,
  options: { includeCancelled?: boolean } = {},
) {
  if (token.length < 32 || token.length > 200) return null;

  const db = getDb();
  const conditions = [
    eq(registrationAccessTokens.tokenHash, hashRegistrationAccessToken(token)),
    gt(registrationAccessTokens.expiresAt, new Date()),
    eq(events.slug, slug),
    eq(users.active, true),
  ];
  if (!options.includeCancelled) {
    conditions.push(ne(registrations.status, "cancelled"));
  }
  const [access] = await db
    .select({
      tokenId: registrationAccessTokens.id,
      registrationId: registrations.id,
      participantId: users.id,
      participantName: users.name,
      participantEmail: users.email,
      eventId: events.id,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStatus: events.status,
    })
    .from(registrationAccessTokens)
    .innerJoin(
      registrations,
      eq(registrationAccessTokens.registrationId, registrations.id),
    )
    .innerJoin(users, eq(registrations.participantId, users.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(and(...conditions))
    .limit(1);

  if (!access) return null;

  await db
    .update(registrationAccessTokens)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(registrationAccessTokens.id, access.tokenId));

  return access;
}
