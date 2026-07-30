import {
  and,
  gt,
  lt,
  ne,
  notInArray,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/db";
import { events } from "@/db/schema";

export type ScheduledEvent = {
  id: string;
  title: string;
  slug: string;
  format: "live" | "simulated" | "hybrid";
  status: string;
  startsAt: Date;
  endsAt: Date;
  createdBy: string;
};

export type ScheduleConflict = {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  reasons: ("organizer" | "zoom_license")[];
};

function conflictReasons(
  candidate: Pick<ScheduledEvent, "format" | "createdBy">,
  existing: Pick<ScheduledEvent, "format" | "createdBy">,
) {
  const reasons: ScheduleConflict["reasons"] = [];
  if (candidate.createdBy === existing.createdBy) reasons.push("organizer");
  if (candidate.format !== "simulated" && existing.format !== "simulated") {
    reasons.push("zoom_license");
  }
  return reasons;
}

function overlaps(
  first: Pick<ScheduledEvent, "startsAt" | "endsAt">,
  second: Pick<ScheduledEvent, "startsAt" | "endsAt">,
) {
  return first.startsAt < second.endsAt && first.endsAt > second.startsAt;
}

function toConflict(
  record: ScheduledEvent,
  reasons: ScheduleConflict["reasons"],
): ScheduleConflict {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    reasons,
  };
}

export async function findScheduleConflicts({
  startsAt,
  endsAt,
  format,
  createdBy,
  excludeEventId,
}: {
  startsAt: Date;
  endsAt: Date;
  format: ScheduledEvent["format"];
  createdBy: string;
  excludeEventId?: string;
}) {
  const conditions: SQL[] = [
    lt(events.startsAt, endsAt),
    gt(events.endsAt, startsAt),
    notInArray(events.status, ["completed", "cancelled"]),
  ];
  if (excludeEventId) conditions.push(ne(events.id, excludeEventId));

  const records = await getDb()
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      format: events.format,
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      createdBy: events.createdBy,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(events.startsAt);

  return records
    .map((record) => ({
      record,
      reasons: conflictReasons({ format, createdBy }, record),
    }))
    .filter((item) => item.reasons.length)
    .map((item) => toConflict(item.record, item.reasons));
}

export function attachScheduleConflicts<T extends ScheduledEvent>(
  records: T[],
): (T & { conflicts: ScheduleConflict[] })[] {
  return records.map((record) => {
    if (["completed", "cancelled"].includes(record.status)) {
      return { ...record, conflicts: [] };
    }
    const conflicts = records
      .filter(
        (candidate) =>
          candidate.id !== record.id &&
          !["completed", "cancelled"].includes(candidate.status) &&
          overlaps(record, candidate),
      )
      .map((candidate) => ({
        candidate,
        reasons: conflictReasons(record, candidate),
      }))
      .filter((item) => item.reasons.length)
      .map((item) => toConflict(item.candidate, item.reasons));
    return { ...record, conflicts };
  });
}
