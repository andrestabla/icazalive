export const REGISTRATION_FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "checkbox",
] as const;

export type RegistrationFieldType =
  (typeof REGISTRATION_FIELD_TYPES)[number];

export type RegistrationFieldDefinition = {
  id: string;
  fieldKey: string;
  label: string;
  type: RegistrationFieldType;
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  options: string[];
  active: boolean;
  position: number;
};

export function normalizeFieldOptions(
  type: RegistrationFieldType,
  raw: unknown,
) {
  if (type !== "select") return [];
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/\r?\n|,/)
      : [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 30);
}

export function createRegistrationFieldKey(label: string) {
  const base =
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 42) || "campo";
  return `${base}_${Date.now().toString(36)}`;
}

export function validateRegistrationResponses(
  fields: RegistrationFieldDefinition[],
  rawResponses: unknown,
) {
  const source =
    rawResponses &&
    typeof rawResponses === "object" &&
    !Array.isArray(rawResponses)
      ? (rawResponses as Record<string, unknown>)
      : {};
  const values: { fieldId: string; value: string }[] = [];

  for (const field of fields.filter((item) => item.active)) {
    const raw = source[field.id];
    if (field.type === "checkbox") {
      const checked =
        raw === true || raw === "true" || raw === "on" || raw === "1";
      if (field.required && !checked) {
        return {
          error: `Debes aceptar “${field.label}”.`,
          values: [],
        };
      }
      values.push({ fieldId: field.id, value: checked ? "true" : "false" });
      continue;
    }

    const value = typeof raw === "string" ? raw.trim() : "";
    if (field.required && !value) {
      return {
        error: `Completa el campo “${field.label}”.`,
        values: [],
      };
    }
    if (!value) continue;
    const maximum = field.type === "textarea" ? 3000 : 500;
    if (value.length > maximum) {
      return {
        error: `El campo “${field.label}” supera el límite permitido.`,
        values: [],
      };
    }
    if (field.type === "select" && !field.options.includes(value)) {
      return {
        error: `Selecciona una opción válida en “${field.label}”.`,
        values: [],
      };
    }
    values.push({ fieldId: field.id, value });
  }

  return { error: null, values };
}
