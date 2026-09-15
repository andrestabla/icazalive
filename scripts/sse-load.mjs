// Prueba de carga SSE contra producción: abre N conexiones EventSource
// (fetch streaming) al canal de sala y mide cuántas quedan abiertas,
// errores, latencia al primer byte y heartbeats recibidos.
const ORIGIN = process.env.ORIGIN || "https://liveicazajammoul.com";
const SLUG = process.env.SLUG;
const TOKEN = process.env.TOKEN;
const TOTAL = Number(process.env.TOTAL || 500);
const BATCH = Number(process.env.BATCH || 50);
const HOLD_MS = Number(process.env.HOLD_MS || 90_000);
if (!SLUG || !TOKEN) { console.error("SLUG y TOKEN requeridos"); process.exit(1); }

const url = `${ORIGIN}/api/public/events/${SLUG}/room/stream?access=${encodeURIComponent(TOKEN)}`;
const stats = { opened: 0, connected: 0, failed: 0, closedEarly: 0, heartbeats: 0, statuses: {}, ttfb: [] };
const controllers = [];

async function openOne(i) {
  const ac = new AbortController();
  controllers.push(ac);
  const t0 = performance.now();
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { accept: "text/event-stream" } });
    stats.statuses[res.status] = (stats.statuses[res.status] || 0) + 1;
    if (res.status !== 200 || !res.body) { stats.failed++; return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let first = true;
    while (true) {
      const { value, done } = await reader.read();
      if (done) { if (!ac.signal.aborted) stats.closedEarly++; return; }
      const text = dec.decode(value);
      if (first) { first = false; stats.ttfb.push(performance.now() - t0); stats.connected++; }
      if (text.includes("heartbeat")) stats.heartbeats++;
    }
  } catch (e) {
    if (!ac.signal.aborted) { stats.failed++; const k = e?.cause?.code || e?.name || "err"; stats.statuses[k] = (stats.statuses[k] || 0) + 1; }
  }
}

function pct(arr, p) { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); }
function report(label) {
  console.log(`${label} abiertas=${stats.opened} conectadas=${stats.connected} fallidas=${stats.failed} cerradas_antes=${stats.closedEarly} heartbeats=${stats.heartbeats} ttfb_p50=${pct(stats.ttfb, .5)}ms p95=${pct(stats.ttfb, .95)}ms max=${pct(stats.ttfb, 1)}ms estados=${JSON.stringify(stats.statuses)}`);
}

async function probe() {
  const t0 = performance.now();
  try {
    const r = await fetch(`${ORIGIN}/register/${SLUG}`, { cache: "no-store" });
    return `${r.status} ${Math.round(performance.now() - t0)}ms`;
  } catch (e) { return `ERR ${e?.cause?.code || e.message}`; }
}

const start = Date.now();
for (let i = 0; i < TOTAL; i += BATCH) {
  for (let j = i; j < Math.min(TOTAL, i + BATCH); j++) { stats.opened++; openOne(j); }
  await new Promise((r) => setTimeout(r, 1000));
  report(`t+${Math.round((Date.now() - start) / 1000)}s`);
}
console.log("ramp completa; sosteniendo", HOLD_MS / 1000, "s");
const interval = setInterval(async () => { report(`t+${Math.round((Date.now() - start) / 1000)}s`); console.log("  página de registro durante la carga:", await probe()); }, 15_000);
await new Promise((r) => setTimeout(r, HOLD_MS));
clearInterval(interval);
report("FINAL");
for (const c of controllers) c.abort();
process.exit(0);
