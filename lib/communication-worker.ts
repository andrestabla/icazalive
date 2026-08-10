import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { communicationDeliveries } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  activeProviderName,
  sendEmail,
  type EmailProviderName,
} from "@/lib/email-provider";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

export type WorkerSummary = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  provider: EmailProviderName;
};

// Planificador/worker de la cola de comunicaciones: procesa confirmaciones en
// cola y recordatorios cuya hora programada ya llegó. Reintenta con backoff
// exponencial y marca como fallidas las entregas que agotan los intentos.
export async function processDueDeliveries(
  eventId?: string,
): Promise<WorkerSummary> {
  const db = getDb();
  const now = new Date();
  const conditions = [
    inArray(communicationDeliveries.status, ["queued", "scheduled"]),
    lte(communicationDeliveries.scheduledFor, now),
  ];
  if (eventId) {
    conditions.push(eq(communicationDeliveries.eventId, eventId));
  }

  const due = await db
    .select()
    .from(communicationDeliveries)
    .where(and(...conditions))
    .orderBy(communicationDeliveries.scheduledFor)
    .limit(BATCH_SIZE);

  const summary: WorkerSummary = {
    processed: due.length,
    sent: 0,
    retried: 0,
    failed: 0,
    provider: activeProviderName(),
  };

  for (const delivery of due) {
    const result = await sendEmail({
      to: delivery.recipientEmail,
      subject: delivery.subject,
      body: delivery.body,
    });

    if (result.ok) {
      summary.sent += 1;
      await db
        .update(communicationDeliveries)
        .set({
          status: "sent",
          sentAt: new Date(),
          providerId: result.providerId,
          attempts: delivery.attempts + 1,
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(communicationDeliveries.id, delivery.id));
      continue;
    }

    const attempts = delivery.attempts + 1;
    // Un error permanente (credenciales, remitente sin verificar) no se
    // reintenta: se marca fallida de inmediato para no repetir la llamada.
    if (result.retryable === false || attempts >= MAX_ATTEMPTS) {
      summary.failed += 1;
      await db
        .update(communicationDeliveries)
        .set({
          status: "failed",
          attempts,
          error: result.error,
          updatedAt: new Date(),
        })
        .where(eq(communicationDeliveries.id, delivery.id));
    } else {
      // Backoff exponencial: 2, 4 minutos antes del siguiente intento.
      summary.retried += 1;
      await db
        .update(communicationDeliveries)
        .set({
          attempts,
          error: result.error,
          scheduledFor: new Date(Date.now() + 2 ** attempts * 60_000),
          updatedAt: new Date(),
        })
        .where(eq(communicationDeliveries.id, delivery.id));
    }
  }

  if (summary.processed > 0) {
    await writeAuditLog({
      action: "communications.worker.processed",
      resourceType: "communications",
      resourceId: eventId ?? null,
      summary: `Worker de correo: ${summary.sent} enviadas, ${summary.retried} reintentos, ${summary.failed} fallidas (proveedor ${summary.provider}).`,
      details: { ...summary },
    });
  }
  return summary;
}

export async function pendingDeliveriesCount(eventId?: string): Promise<number> {
  const db = getDb();
  const conditions = [
    inArray(communicationDeliveries.status, ["queued", "scheduled"]),
  ];
  if (eventId) conditions.push(eq(communicationDeliveries.eventId, eventId));
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(communicationDeliveries)
    .where(and(...conditions));
  return row?.total ?? 0;
}
