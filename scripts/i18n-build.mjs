#!/usr/bin/env node
// Construye lib/i18n/en.ts a partir de la lista de textos (es-items.json) y
// los archivos de traducción id<TAB>inglés. Uso:
//   node scripts/i18n-build.mjs <es-items.json> <parte1.tsv> [parte2.tsv ...]
import fs from "node:fs";
const args = process.argv.slice(2);
const extras = args.filter((a) => a.endsWith(".json") && a !== args[0]);
const [itemsPath, ...parts] = args.filter((a) => !extras.includes(a));
const items = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const translations = new Map();
for (const part of parts) {
  for (const line of fs.readFileSync(part, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const id = Number(line.slice(0, tab));
    const value = line.slice(tab + 1).replace(/\\n/g, "\n");
    if (Number.isFinite(id)) translations.set(id, value);
  }
}
// Se conserva un diccionario previo (traducciones añadidas a mano) si existe.
let previous = { EN: {}, EN_PATTERNS: {} };
try {
  const en = fs.readFileSync("lib/i18n/en.ts", "utf8");
  const grab = (name) => { const m = en.match(new RegExp(`export const ${name}: Record<string, string> = (\\{[\\s\\S]*?\\n\\});`)); return m ? Function(`return ${m[1]}`)() : {}; };
  previous = { EN: grab("EN"), EN_PATTERNS: grab("EN_PATTERNS") };
} catch { /* primera construcción */ }

const EN = { ...previous.EN }; const EN_PATTERNS = { ...previous.EN_PATTERNS };
let count = 0;
items.forEach(([kind, source], id) => {
  const value = translations.get(id);
  if (value === undefined) return;
  const key = kind === "P" ? source : source.trim();
  const target = kind === "P" ? value : value.trim();
  if (!key || key === target) return;
  (kind === "P" ? EN_PATTERNS : EN)[key] = target; count += 1;
});
// Textos que no salen del código (semillas, etiquetas guardadas): {"es": "en"}.
for (const extra of extras) {
  const pairs = JSON.parse(fs.readFileSync(extra, "utf8"));
  for (const [source, target] of Object.entries(pairs.strings ?? {})) EN[source] = target;
  for (const [source, target] of Object.entries(pairs.patterns ?? {})) EN_PATTERNS[source] = target;
}
// Variante sin el símbolo inicial ("＋ Añadir miembro" → "Añadir miembro"): en
// producción algunos botones usan iconos en lugar del símbolo.
for (const [key, value] of Object.entries(EN)) {
  const m = key.match(/^[^\p{L}\p{N}]+\s+(.+)$/u);
  if (m && EN[m[1]] === undefined) EN[m[1]] = value.replace(/^[^\p{L}\p{N}]+\s+/u, "");
}
const sortObj = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, "es")));
const render = (obj) => JSON.stringify(sortObj(obj), null, 1).replace(/^ /gm, "  ");
fs.writeFileSync("lib/i18n/en.ts", `// Diccionario español → inglés de la interfaz. Generado con scripts/i18n-build.mjs
// a partir de los textos del código (scripts/i18n-extract.mjs). Las claves son
// los fragmentos de texto tal como los pinta React, sin espacios en los extremos.
export const EN: Record<string, string> = ${render(EN)};
// Textos con partes variables: {0}, {1}… se sustituyen por lo que haya en el DOM.
export const EN_PATTERNS: Record<string, string> = ${render(EN_PATTERNS)};
`);
console.log(`diccionario: ${Object.keys(EN).length} textos, ${Object.keys(EN_PATTERNS).length} patrones (${count} de esta construcción)`);
