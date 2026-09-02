import { NextResponse } from "next/server";
import { processDueDeliveries } from "@/lib/communication-worker";
import { runSimulatedAutomation } from "@/lib/simulated-emitter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Respaldo externo del planificador: un cron (Replit Scheduled Deployment,
// cron-job.org, etc.) llama aquí cada 5 minutos con el secreto CRON_SECRET.
//   GET /api/cron/communications  con  Authorization: Bearer <CRON_SECRET>
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const query = new URL(request.url).searchParams.get("token") ?? "";
  return bearer === secret || query === secret;
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET no está configurado en el servidor." },
      { status: 503 },
    );
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const summary = await processDueDeliveries();
  const simulated = await runSimulatedAutomation().catch(() => ({ started: 0, stopped: 0 }));
  return NextResponse.json(
    { data: { ...summary, simulated, at: new Date().toISOString() } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = handle;
export const POST = handle;
