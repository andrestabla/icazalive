const DEFAULT_BLOCKED_TERMS = [
  "imbécil",
  "imbecil",
  "estúpido",
  "estupido",
  "idiota",
];

export const ALLOWED_REACTIONS = ["👏", "❤️", "👍", "🎉", "✋"] as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

export function cleanInteractionText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function findBlockedTerm(value: string) {
  const configured = process.env.INTERACTION_BLOCKED_TERMS?.split(",")
    .map((term) => term.trim())
    .filter(Boolean);
  const terms = configured?.length ? configured : DEFAULT_BLOCKED_TERMS;
  const normalizedValue = ` ${normalize(value).replace(/[^\p{L}\p{N}]+/gu, " ")} `;

  return (
    terms.find((term) =>
      normalizedValue.includes(` ${normalize(term)} `),
    ) ?? null
  );
}

export function isAllowedReaction(
  value: string,
): value is (typeof ALLOWED_REACTIONS)[number] {
  return ALLOWED_REACTIONS.includes(
    value as (typeof ALLOWED_REACTIONS)[number],
  );
}
