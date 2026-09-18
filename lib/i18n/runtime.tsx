"use client";

import { useEffect } from "react";
import { RULES, type Rule } from "./rules";

// Traduce la interfaz ya renderizada: recorre los textos y atributos
// visibles, los cambia por su equivalente del diccionario y observa el DOM
// para traducir lo que React vaya pintando después. Los valores escritos por
// el usuario (inputs, textareas, código) no se tocan.
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT", "INPUT", "SELECT_VALUE"]);
const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt", "data-tooltip", "aria-description"];

type Dict = Record<string, string>;

function compilePatterns(patterns: Dict, dict: Dict): Rule[] {
  return Object.entries(patterns).map(([source, target]) => {
    const parts = source.split(/\{\d+\}/);
    const re = new RegExp("^" + parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)") + "$", "s");
    // Las partes variables también se traducen si son textos conocidos
    // (por ejemplo, "creó" dentro de "{0} {1} un evento").
    const to = (...groups: string[]) => target.replace(/\{(\d+)\}/g, (_m, n) => {
      const value = groups[Number(n) + 1] ?? "";
      return dict[value] ?? value;
    });
    return { re, to };
  });
}

export function createTranslator(dict: Dict, rules: Rule[]) {
  const cache = new Map<string, string | null>();
  const translateCore = (core: string): string | null => {
    if (!core) return null;
    const direct = dict[core];
    if (direct !== undefined) return direct;
    // Símbolo inicial (＋, ✓, ↓…) seguido de un texto conocido.
    const symbol = core.match(/^([^\p{L}\p{N}]+\s+)(.+)$/u);
    if (symbol && dict[symbol[2]] !== undefined) return symbol[1] + dict[symbol[2]];
    const trailing = core.match(/^(.+?)(\s+[^\p{L}\p{N}\s.…!?)]+)$/u);
    if (trailing && dict[trailing[1]] !== undefined) return dict[trailing[1]] + trailing[2];
    // Las reglas se aplican en cadena: una fecha puede necesitar varias.
    let out = core;
    for (const rule of rules) {
      rule.re.lastIndex = 0;
      if (rule.re.test(out)) {
        rule.re.lastIndex = 0;
        out = out.replace(rule.re, rule.to as string);
      }
    }
    if (out !== core) return out;
    // Frases con separador "·" o " — ": se traducen por partes.
    if (/ · | — /.test(core)) {
      const parts = core.split(/( · | — )/);
      let changed = false;
      const out = parts.map((part, index) => {
        if (index % 2 === 1) return part;
        const t = translateCore(part.trim());
        if (t !== null) changed = true;
        return t ?? part;
      }).join("");
      if (changed) return out;
    }
    return null;
  };
  return (text: string): string | null => {
    if (cache.has(text)) return cache.get(text)!;
    const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const lead = match?.[1] ?? "";
    const core = match?.[2] ?? text;
    const trail = match?.[3] ?? "";
    let out = translateCore(core);
    if (out === null && /[:.…!?]$/.test(core)) {
      const inner = translateCore(core.slice(0, -1));
      if (inner !== null) out = inner + core.slice(-1);
    }
    const result = out === null ? null : lead + out + trail;
    if (cache.size < 5000) cache.set(text, result);
    return result;
  };
}

function isSkipped(node: Node): boolean {
  let el: Element | null = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName) || el.getAttribute("translate") === "no" || el.hasAttribute("data-i18n-skip") || (el as HTMLElement).isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

export function installTranslator(dict: Dict, patterns: Dict, rules: Rule[]) {
  const translate = createTranslator(dict, [...compilePatterns(patterns, dict), ...rules]);
  const last = new WeakMap<Node, string>();
  const lastAttr = new WeakMap<Element, Map<string, string>>();
  const missing = new Set<string>();

  const translateText = (node: Text) => {
    const value = node.nodeValue ?? "";
    if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ¿¡]/.test(value)) return;
    if (last.get(node) === value) return;
    if (isSkipped(node)) return;
    const out = translate(value);
    if (out === null) {
      if (/[áéíóúñ¿¡]|\b(el|la|los|las|de|del|para|con|por|una?|que|sin|y|o)\b/i.test(value) && value.trim().length > 1) missing.add(value.trim());
      return;
    }
    if (out !== value) {
      node.nodeValue = out;
    }
    last.set(node, out);
  };
  const translateAttributes = (el: Element) => {
    if (isSkipped(el) && el.tagName !== "INPUT") return;
    let map = lastAttr.get(el);
    for (const name of ATTRIBUTES) {
      const value = el.getAttribute(name);
      if (!value || map?.get(name) === value) continue;
      const out = translate(value);
      if (out !== null && out !== value) el.setAttribute(name, out);
      if (!map) { map = new Map(); lastAttr.set(el, map); }
      map.set(name, out ?? value);
    }
    if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button") && el.value) {
      const out = translate(el.value);
      if (out !== null && out !== el.value) el.value = out;
    }
  };
  const walk = (root: Node) => {
    if (root.nodeType === Node.TEXT_NODE) { translateText(root as Text); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root as Element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) translateText(current as Text);
      else translateAttributes(current as Element);
      current = walker.nextNode();
    }
  };
  const translateTitle = () => {
    const out = translate(document.title);
    if (out !== null && out !== document.title) document.title = out;
  };

  walk(document.body);
  translateTitle();
  document.documentElement.classList.add("i18n-ready");

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") translateText(record.target as Text);
      else if (record.type === "attributes") translateAttributes(record.target as Element);
      else record.addedNodes.forEach((node) => walk(node));
    }
    translateTitle();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
  (window as unknown as { __i18n?: unknown }).__i18n = {
    missing: () => Array.from(missing).sort(),
    translate,
  };
  return () => {
    observer.disconnect();
    document.documentElement.classList.remove("i18n-ready");
  };
}

export default function I18nRuntime({ locale }: { locale: string }) {
  useEffect(() => {
    if (locale !== "en") {
      document.documentElement.classList.add("i18n-ready");
      return;
    }
    // La traducción arranca cuando la página terminó de cargar e hidratarse:
    // si se cambiara el texto antes, React lo detectaría como una diferencia
    // con el HTML del servidor y volvería a pintar el árbol.
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    let timer = 0;
    const start = () => {
      if (cancelled) return;
      const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      const run = () => {
        if (cancelled) return;
        timer = window.setTimeout(() => {
          // El diccionario solo se descarga cuando el idioma es inglés.
          void import("./en").then(({ EN, EN_PATTERNS }) => {
            if (!cancelled) cleanup = installTranslator(EN, EN_PATTERNS, RULES);
          });
        }, 120);
      };
      if (idle) idle(run, { timeout: 800 });
      else run();
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, [locale]);
  return null;
}
