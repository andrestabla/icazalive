#!/usr/bin/env python3
"""Comunicaciones: reencolar y reenviar los mensajes con error.
- lib/communication-worker.ts: requeueFailedDeliveries()
- app/api/events/[slug]/communications/process/route.ts: { retryFailed: true }
- app/events/[slug]/event-detail.tsx: botón "Reintentar con error (n)"
- app/globals.css: estilo del botón
Idempotente y con anclas: no sobrescribe archivos completos."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def patch(rel, pairs, marker):
    p = root / rel; s = p.read_text(encoding="utf-8")
    if marker in s:
        print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if old not in s:
            print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8"); print(f"OK {rel}: aplicado")

# 1. Worker
worker_anchor = "// Disparo en segundo plano (tras responder una petición): no bloquea ni"
worker_add = '''// Vuelve a poner en cola las entregas fallidas de un evento (o de todos).
// Se usa cuando la causa del fallo ya se corrigió, por ejemplo al cambiar el
// proveedor de correo en Integraciones: el organizador pulsa "Reintentar con
// error" y las confirmaciones salen sin volver a inscribir a nadie.
export async function requeueFailedDeliveries(eventId?: string): Promise<number> {
  const db = getDb();
  const conditions = [eq(communicationDeliveries.status, "failed")];
  if (eventId) conditions.push(eq(communicationDeliveries.eventId, eventId));
  const rows = await db
    .update(communicationDeliveries)
    .set({
      status: "queued",
      attempts: 0,
      error: null,
      scheduledFor: new Date(),
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ id: communicationDeliveries.id });
  if (rows.length) {
    await writeAuditLog({
      action: "communications.deliveries.requeued",
      resourceType: "communications",
      resourceId: eventId ?? null,
      summary: `${rows.length} entrega(s) con error vueltas a la cola.`,
      details: { count: rows.length },
    });
  }
  return rows.length;
}

'''
patch("lib/communication-worker.ts", [(worker_anchor, worker_add + worker_anchor)], "requeueFailedDeliveries")

# 2. Ruta process
patch("app/api/events/[slug]/communications/process/route.ts", [
    ('import { processDueDeliveries } from "@/lib/communication-worker";',
     'import { processDueDeliveries, requeueFailedDeliveries } from "@/lib/communication-worker";'),
    ('export async function POST(_: Request, context: RouteContext) {',
     'export async function POST(request: Request, context: RouteContext) {'),
    ('''  const summary = await processDueDeliveries(event.id);
  return NextResponse.json({
    data: { ...summary, provider: activeProviderName() },
  });''',
     '''  // { retryFailed: true } vuelve a encolar las entregas con error antes de
  // procesar, para reenviarlas una vez corregida la causa (p. ej. proveedor).
  const body = (await request.json().catch(() => ({}))) as { retryFailed?: boolean };
  const requeued = body.retryFailed === true ? await requeueFailedDeliveries(event.id) : 0;
  const summary = await processDueDeliveries(event.id);
  return NextResponse.json({
    data: { ...summary, requeued, provider: activeProviderName() },
  });'''),
], "retryFailed")

# 3. Botón en Comunicaciones (tolerante a sangría/espacios: busca el botón
#    "Procesar cola ahora" y añade el de reintento justo después).
import re
ed = root / "app/events/[slug]/event-detail.tsx"; e = ed.read_text(encoding="utf-8")
if "worker-retry-button" in e:
    print("OK app/events/[slug]/event-detail.tsx: ya aplicado")
else:
    m = re.search(r"Procesar cola ahora[^\n]*\n(\s*)</button>\n", e)
    if not m:
        print("ERROR event-detail.tsx: no se encontró el botón 'Procesar cola ahora'"); sys.exit(1)
    ind = m.group(1)  # sangría de </button>
    block = """{IND}{deliveryTotal("failed") > 0 && (
{IND}  <button
{IND}    className="worker-run-button worker-retry-button"
{IND}    disabled={saving}
{IND}    onClick={() => {
{IND}      void fetch(`/api/events/${event.slug}/communications/process`, {
{IND}        method: "POST",
{IND}        headers: { "Content-Type": "application/json" },
{IND}        body: JSON.stringify({ retryFailed: true }),
{IND}      })
{IND}        .then((response) => response.json())
{IND}        .then((payload: { data?: { sent: number; retried: number; failed: number; requeued: number; provider: string }; error?: string }) => {
{IND}          if (payload.data) {
{IND}            setMessage(
{IND}              `${payload.data.requeued} mensaje(s) con error vueltos a la cola: ${payload.data.sent} enviados, ${payload.data.retried} en reintento, ${payload.data.failed} fallidos de nuevo (proveedor ${payload.data.provider}).`,
{IND}            );
{IND}            void refreshCommunications();
{IND}          } else {
{IND}            setMessage(payload.error ?? "No fue posible reintentar los envíos.");
{IND}          }
{IND}        });
{IND}    }}
{IND}    title="Vuelve a enviar los mensajes que fallaron (por ejemplo, tras corregir el proveedor de correo en Integraciones)"
{IND}  >
{IND}    Reintentar con error ({deliveryTotal("failed")}) ↻
{IND}  </button>
{IND})}
""".replace("{IND}", ind)
    e = e[: m.end()] + block + e[m.end():]
    ed.write_text(e, encoding="utf-8"); print("OK app/events/[slug]/event-detail.tsx: aplicado")

# 4. CSS
css = root / "app/globals.css"; c = css.read_text(encoding="utf-8")
if "worker-retry-button" not in c:
    c = c.rstrip("\n") + '''

/* Comunicaciones: botón para reenviar los mensajes con error. */
.worker-retry-button { border-color: #d98b86 !important; color: #a8322c !important; }
.worker-retry-button:hover { background: #fdf1f0 !important; }
'''
    css.write_text(c, encoding="utf-8"); print("OK app/globals.css: aplicado")
else:
    print("OK app/globals.css: ya aplicado")
print("LISTO reintentar con error")
