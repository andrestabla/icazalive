import { NextResponse } from "next/server";
import { getAuditEntries, type AuditOutcome } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { requireApiPermission } from "@/lib/api-guards";

export const runtime = "nodejs";

const outcomes: AuditOutcome[] = ["success", "denied", "failure"];

export async function GET(request: Request) {
  const permissionCheck = await requireApiPermission("audit.view");
  if ("error" in permissionCheck) return permissionCheck.error;
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role !== "administrator") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.slice(0, 120) ?? undefined;
  const outcomeCandidate = url.searchParams.get("outcome");
  const outcome =
    outcomeCandidate && outcomes.includes(outcomeCandidate as AuditOutcome)
      ? (outcomeCandidate as AuditOutcome)
      : undefined;
  const resourceType =
    url.searchParams.get("resourceType")?.slice(0, 80) ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const result = await getAuditEntries({
    query,
    outcome,
    resourceType,
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
