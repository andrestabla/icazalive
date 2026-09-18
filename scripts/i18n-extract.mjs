#!/usr/bin/env node
// Extrae los textos de interfaz (español) de los componentes y rutas para
// alimentar el diccionario lib/i18n/en.ts. Uso:
//   node scripts/i18n-extract.mjs [raíz] [--missing]   (--missing: solo los que faltan en en.ts)
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : ".";
const onlyMissing = process.argv.includes("--missing");
const EXCLUDE = [
  /^app\/(room|register|manage-registration|calendar|public-home|api\/public)(\/|\.|$)/,
  /^app\/privacy\/page\.tsx$/, /^app\/privacy\/privacy-/, /^app\/privacy\/legal/,
  /^lib\/(default-communications|help-guides|team-notifications|communication-renderer|communication-worker|email-branding|live-notifications|simulated-emitter|calendar-links)\.ts$/,
  /\.css$/, /\.test\./, /^app\/help\//, /^app\/components\/help-widget\.tsx$/, /^lib\/help-content\.ts$/, /^lib\/i18n\//, /^lib\/xlsx/,
];
const ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "aria-description", "label", "data-tooltip"]);

function walkDir(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!["node_modules", ".next"].includes(entry.name)) walkDir(full, out); }
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
}

function cleanJsxText(text) {
  const lines = text.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  lines.forEach((line, i) => { if (line.match(/[^ \t]/)) lastNonEmpty = i; });
  let out = "";
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, " ");
    if (i !== 0) t = t.replace(/^[ ]+/, "");
    if (i !== lines.length - 1) t = t.replace(/[ ]+$/, "");
    if (t) { if (i !== lastNonEmpty) t += " "; out += t; }
  });
  return out;
}

const HAS_LETTER = /[A-Za-zÁÉÍÓÚÑáéíóúñ]/;
function looksLikeUi(value) {
  const v = value.trim();
  if (!v || !HAS_LETTER.test(v)) return false;
  if (/^(https?:|\/|@\/|\.\/|#|mailto:|data:)/.test(v)) return false;
  if (/\{\{|\}\}/.test(v)) return false; // variables de plantillas de correo
  if (/<\/|<\?xml|^[A-Z0-9_]*_[A-Z0-9_]*$/.test(v)) return false; // XML, nombres de variables
  if (/^[A-Z]{1,3}$/.test(v)) return false;
  if (/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)) return true;
  if (/\s/.test(v)) return !/^[a-z0-9_-]+(\s[a-z0-9_-]+)+$/.test(v) || /\b(el|la|los|las|de|del|para|con|por|un|una|que|sin|y|o|en|al|se|su|tu)\b/.test(v);
  // Una sola palabra: solo si empieza en mayúscula y no es una constante ni un identificador.
  if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}…?$/.test(v)) return true;
  return false;
}

const files = []; walkDir(path.join(root, "app"), files); walkDir(path.join(root, "lib"), files);
const strings = new Set(); const patterns = new Set(); const where = new Map();
const add = (set, value, file) => { if (!value) return; set.add(value); if (!where.has(value)) where.set(value, file); };

for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (EXCLUDE.some((re) => re.test(rel))) continue;
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      if (!node.containsOnlyTriviaWhiteSpaces) { const t = cleanJsxText(node.text); if (HAS_LETTER.test(t)) add(strings, t, rel); }
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText();
      if (ATTRS.has(name) && looksLikeUi(node.initializer.text)) add(strings, node.initializer.text, rel);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const isImport = parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isCallExpression(parent) && parent.expression.getText() === "require");
      const isPropertyName = parent && ts.isPropertyAssignment(parent) && parent.name === node;
      const isTypeContext = parent && (ts.isLiteralTypeNode(parent));
      const isJsxAttrValue = parent && ts.isJsxAttribute(parent);
      const isCaseOrEq = parent && (ts.isCaseClause(parent) || (ts.isBinaryExpression(parent) && /===|!==/.test(parent.operatorToken.getText())));
      const isElementAccess = parent && ts.isElementAccessExpression(parent) && parent.argumentExpression === node;
      if (!isImport && !isPropertyName && !isTypeContext && !isJsxAttrValue && !isCaseOrEq && !isElementAccess && looksLikeUi(node.text)) add(strings, node.text, rel);
    } else if (ts.isTemplateExpression(node)) {
      let pattern = node.head.text; let i = 0; let letters = HAS_LETTER.test(node.head.text);
      for (const span of node.templateSpans) { pattern += `{${i++}}` + span.literal.text; if (HAS_LETTER.test(span.literal.text)) letters = true; }
      const literal = pattern.replace(/\{\d+\}/g, " ");
      if (letters && looksLikeUi(literal) && !/^\{0\}$/.test(pattern.trim())) add(patterns, pattern, rel);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

let dict = {}; let dictPatterns = {};
try {
  const en = fs.readFileSync(path.join(root, "lib/i18n/en.ts"), "utf8");
  const grab = (name) => { const m = en.match(new RegExp(`export const ${name}: Record<string, string> = (\\{[\\s\\S]*?\\n\\});`)); return m ? Function(`return ${m[1]}`)() : {}; };
  dict = grab("EN"); dictPatterns = grab("EN_PATTERNS");
} catch { /* sin diccionario aún */ }
const known = (s) => dict[s.trim()] !== undefined || dict[s.trim().replace(/^[^\p{L}\p{N}]+\s+/u, "")] !== undefined || dict[s.trim().replace(/\s+[^\p{L}\p{N}\s.…!?)]+$/u, "")] !== undefined;
const list = [...strings].filter((s) => !onlyMissing || !known(s)).sort((a, b) => a.localeCompare(b, "es"));
const plist = [...patterns].filter((s) => !onlyMissing || dictPatterns[s] === undefined).sort((a, b) => a.localeCompare(b, "es"));
const out = { strings: list, patterns: plist, where: Object.fromEntries([...list, ...plist].map((s) => [s, where.get(s)])) };
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
console.error(`textos: ${list.length} (de ${strings.size}) · patrones: ${plist.length} (de ${patterns.size})`);
