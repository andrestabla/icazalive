// Arranque del servidor: enciende el planificador de comunicaciones en el
// runtime de Node (no en el build ni en Edge).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.COMMUNICATIONS_SCHEDULER === "off") return;
  const { startCommunicationScheduler } = await import(
    "./lib/communication-worker"
  );
  startCommunicationScheduler();
}
