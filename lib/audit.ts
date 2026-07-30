import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import type { AuthenticatedUser } from "@/lib/auth";

export type AuditOutcome = "success" | "denied" | "failure";

type AuditDetails = Record<string, string | number | boolean | null>;

export async function writeAuditLog({
  actor,
  actorEmail,
  action,
  resourceType,
  resourceId,
  outcome = "success",
  summary,
  details,
  request,
}: {
  actor?: AuthenticatedUser | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: AuditOutcome;
  summary: string;
  details?: AuditDetails;
  request?: Request;
}) {
  try {
    const forwardedFor = request?.headers.get("x-forwarded-for");
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() ||
      request?.headers.get("x-real-ip") ||
      null;
    const userAgent = request?.headers.get("user-agent")?.slice(0, 500) ?? null;

    await getDb().insert(auditLogs).values({
      actorUserId: actor?.id ?? null,
      actorEmail: actor?.email ?? actorEmail ?? null,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      outcome,
      summary,
      details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("No fue posible registrar la acción en auditoría.", error);
  }
}

export type AuditFilters = {
  query?: string;
  outcome?: AuditOutcome;
  resourceType?: string;
  limit?: number;
  offset?: number;
};

export async function getAuditEntries(filters: AuditFilters = {}) {
  const conditions: SQL[] = [];
  const query = filters.query?.trim();
  if (query) {
    const pattern = `%${query.slice(0, 120)}%`;
    const searchCondition = or(
      ilike(auditLogs.summary, pattern),
      ilike(auditLogs.action, pattern),
      ilike(auditLogs.resourceType, pattern),
      ilike(auditLogs.actorEmail, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (filters.outcome) {
    conditions.push(eq(auditLogs.outcome, filters.outcome));
  }
  if (filters.resourceType) {
    conditions.push(eq(auditLogs.resourceType, filters.resourceType));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const db = getDb();

  const [entries, totalRows, successRows, deniedRows, failureRows] =
    await Promise.all([
      db
        .select({
          id: auditLogs.id,
          actorUserId: auditLogs.actorUserId,
          actorName: users.name,
          actorEmail: auditLogs.actorEmail,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          outcome: auditLogs.outcome,
          summary: auditLogs.summary,
          details: auditLogs.details,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(auditLogs).where(where),
      db
        .select({ total: count() })
        .from(auditLogs)
        .where(
          where
            ? and(where, eq(auditLogs.outcome, "success"))
            : eq(auditLogs.outcome, "success"),
        ),
      db
        .select({ total: count() })
        .from(auditLogs)
        .where(
          where
            ? and(where, eq(auditLogs.outcome, "denied"))
            : eq(auditLogs.outcome, "denied"),
        ),
      db
        .select({ total: count() })
        .from(auditLogs)
        .where(
          where
            ? and(where, eq(auditLogs.outcome, "failure"))
            : eq(auditLogs.outcome, "failure"),
        ),
    ]);

  return {
    entries,
    summary: {
      total: totalRows[0]?.total ?? 0,
      success: successRows[0]?.total ?? 0,
      denied: deniedRows[0]?.total ?? 0,
      failure: failureRows[0]?.total ?? 0,
    },
    pagination: { limit, offset },
  };
}
