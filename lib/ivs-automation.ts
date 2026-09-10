import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events, sessions } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import type { AuthenticatedUser } from "@/lib/auth";
import { createEventChannel, readIvsCredentials } from "@/lib/aws-ivs";
import { sealSecret } from "@/lib/secret-box";
import { syncZoomLivestreamForEvent } from "@/lib/zoom-ivs-bridge";

// Aprovisionamiento del canal de Amazon IVS al confirmar un evento, igual que
// la reunión de Zoom. Antes había que recordar pulsar "Aprovisionar" a mano y
// el evento llegaba al día de la transmisión sin canal donde recibir la señal.
// La clave de emisión se guarda cifrada para poder mostrarla y enviarla a Zoom después.

type Options = { actor?: AuthenticatedUser | null; request?: Request };

function needsChannel(streamingMode: string) {
  return streamingMode === "zoom_to_ivs" || streamingMode === "ivs_direct";
}

export async function ensureIvsChannelForEvent(eventId: string, options: Options = {}) {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return;
  if (event.status === "cancelled" || event.status === "completed") return;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.eventId, eventId))
    .orderBy(asc(sessions.startsAt))
    .limit(1);
  if (!session || !needsChannel(session.streamingMode) || session.ivsChannelArn) return;

  const credentials = readIvsCredentials();
  if (!credentials) return;

  const creation = await createEventChannel(credentials, {
    name: `icaza-${event.slug}`,
    recordingConfigurationArn: process.env.AWS_IVS_RECORDING_CONFIGURATION_ARN || undefined,
  });

  if (!creation.ok) {
    await writeAuditLog({
      actor: options.actor ?? undefined,
      action: "ivs.channel.failed",
      resourceType: "session",
      resourceId: session.id,
      outcome: "failure",
      summary: `No se pudo crear el canal de IVS de “${event.title}”: ${creation.error}`,
      request: options.request,
    });
    console.error("[ivs] crear canal", creation.error);
    return;
  }

  await db
    .update(sessions)
    .set({
      ivsChannelArn: creation.channel.channelArn,
      playbackUrl: creation.channel.playbackUrl,
      // La clave solo se entrega al crear el canal: se guarda cifrada para
      // poder mostrarla después sin volver a pedírsela a AWS.
      ivsStreamKeyEncrypted: sealSecret(creation.channel.streamKey),
      streamingStatus:
        session.streamingStatus === "not_configured" ? "configured" : session.streamingStatus,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, session.id));

  await writeAuditLog({
    actor: options.actor ?? undefined,
    action: "ivs.channel.created",
    resourceType: "session",
    resourceId: session.id,
    summary: `Canal de Amazon IVS creado automáticamente para “${event.title}”.`,
    details: { channelArn: creation.channel.channelArn },
    request: options.request,
  });

  // Con reunión y canal creados, Zoom queda apuntando al canal sin pasos manuales.
  await syncZoomLivestreamForEvent(eventId, options).catch(() => undefined);
}
