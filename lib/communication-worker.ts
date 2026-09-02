import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { communicationDeliveries } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  activeProviderName,
  sendEmail,
  type EmailProviderName,
} from "@/lib/email-provider";
import { renderBrandedEmail } from "@/lib/email-branding";
import { getBrandSettings } from "@/lib/brand";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

// Un recordatorio que llega demasiado tarde no aporta nada: se cancela en vez
// de enviarse (p. ej. tras una caída del planificador o al inscribirse a un
// evento que ya empezó).
const STALE_AFTER_MS: Partial<Record<string, number>> = {
  reminder_24h: 12 * 60 * 60_000,
  reminder_1h: 2 * 60 * 60_000,
};

export type WorkerSummary = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
  provider: EmailProviderName;
};

export function isStaleDelivery(
  type: string,
  scheduledFor: Date,
  now = new Date(),
): boolean {
  const limit = STALE_AFTER_MS[type];
  return limit !== undefined && now.getTime() - scheduledFor.getTime() > limit;
}

// Planificador/worker de la cola de comunicaciones: procesa confirmaciones en
// cola y recordatorios cuya hora programada ya llegó. Reintenta con backoff
// exponencial y marca como fallidas las entregas que agotan los intentos.
// Varias instancias pueden ejecutarlo a la vez: cada entrega se reclama con
// un bloqueo optimista sobre updated_at, así que nunca se envía dos veces.
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
    processed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    provider: activeProviderName(),
  };
  if (due.length === 0) return summary;

  const brand = await getBrandSettings().catch(() => null);

  for (const delivery of due) {
    // Reclamo atómico: solo quien logra actualizar la fila la procesa.
    const claimedAt = new Date();
    const claimed = await db
      .update(communicationDeliveries)
      .set({ updatedAt: claimedAt })
      .where(
        and(
          eq(communicationDeliveries.id, delivery.id),
          eq(communicationDeliveries.updatedAt, delivery.updatedAt),
          inArray(communicationDeliveries.status, ["queued", "scheduled"]),
        ),
      )
      .returning({ id: communicationDeliveries.id });
    if (claimed.length === 0) continue;
    summary.processed += 1;

    if (isStaleDelivery(delivery.type, delivery.scheduledFor, now)) {
      summary.skipped += 1;
      await db
        .update(communicationDeliveries)
        .set({
          status: "cancelled",
          error: "Recordatorio vencido: la hora programada ya pasó.",
          updatedAt: new Date(),
        })
        .where(eq(communicationDeliveries.id, delivery.id));
      continue;
    }

    const result = await sendEmail({
      to: delivery.recipientEmail,
      subject: delivery.subject,
      body: delivery.body,
      html: renderBrandedEmail({ bodyText: delivery.body, brand }),
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
      summary: `Worker de correo: ${summary.sent} enviadas, ${summary.retried} reintentos, ${summary.failed} fallidas, ${summary.skipped} vencidas (proveedor ${summary.provider}).`,
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

// Disparo en segundo plano (tras responder una petición): no bloquea ni
// propaga errores; el planificador periódico reintenta lo que quede.
export function triggerDeliveries(eventId?: string): void {
  void processDueDeliveries(eventId).catch((error) => {
    console.error("[communications] envío en segundo plano falló:", error);
  });
}

// Planificador interno: mientras el servidor esté vivo revisa la cola cada
// minuto. En Autoscale las instancias pueden dormir sin tráfico, por eso el
// endpoint /api/cron/communications existe como respaldo externo.
const SCHEDULER_INTERVAL_MS = 60_000;
let schedulerHandle: NodeJS.Timeout | null = null;
let schedulerRunning = false;

export function startCommunicationScheduler(): void {
  if (schedulerHandle) return;
  const tick = async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      await processDueDeliveries();
    } catch (error) {
      console.error("[communications] planificador:", error);
    } finally {
      schedulerRunning = false;
    }
  };
  schedulerHandle = setInterval(tick, SCHEDULER_INTERVAL_MS);
  schedulerHandle.unref?.();
  setTimeout(tick, 5_000).unref?.();
}
