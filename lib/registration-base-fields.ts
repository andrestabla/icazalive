// Campos base del formulario de registro. Nombre y correo son fijos; empresa,
// cargo y teléfono se pueden renombrar, hacer obligatorios o retirar por
// evento. Se guarda en events.base_fields (jsonb); null = configuración base.

export type BaseFieldKey = "company" | "jobTitle" | "phone";
export type BaseFieldConfig = { label: string; required: boolean; active: boolean };
export type BaseFieldsConfig = Record<BaseFieldKey, BaseFieldConfig>;

export const BASE_FIELD_KEYS: BaseFieldKey[] = ["company", "jobTitle", "phone"];

export const DEFAULT_BASE_FIELDS: BaseFieldsConfig = {
  company: { label: "Empresa", required: false, active: true },
  jobTitle: { label: "Cargo", required: false, active: true },
  phone: { label: "Teléfono", required: false, active: true },
};

export const BASE_FIELD_HINTS: Record<BaseFieldKey, string> = {
  company: "Organización del asistente.",
  jobTitle: "Rol o posición.",
  phone: "Contacto telefónico (WhatsApp).",
};

export function normalizeBaseFields(
  input: unknown,
  base: BaseFieldsConfig = DEFAULT_BASE_FIELDS,
): BaseFieldsConfig {
  const result: BaseFieldsConfig = {
    company: { ...base.company },
    jobTitle: { ...base.jobTitle },
    phone: { ...base.phone },
  };
  if (input && typeof input === "object") {
    for (const key of BASE_FIELD_KEYS) {
      const value = (input as Record<string, unknown>)[key];
      if (!value || typeof value !== "object") continue;
      const item = value as Record<string, unknown>;
      if (typeof item.label === "string" && item.label.trim().length >= 2) {
        result[key].label = item.label.trim().slice(0, 60);
      }
      if (typeof item.required === "boolean") result[key].required = item.required;
      if (typeof item.active === "boolean") result[key].active = item.active;
      // Un campo inactivo nunca es obligatorio.
      if (!result[key].active) result[key].required = false;
    }
  }
  return result;
}

// Fondo de la página de registro: clave pública en S3 (brand/…) o URL absoluta.
export function normalizeRegistrationBackground(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^brand\/[A-Za-z0-9._-]{1,160}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "invalid";
    if (trimmed.length > 500) return "invalid";
    return url.toString();
  } catch {
    return "invalid";
  }
}
