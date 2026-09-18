#!/usr/bin/env python3
"""Registro: campos base configurables, fondo de la página, compartir enlace,
sin tipología para el participante y contenido destacado. Ediciones ancladas
(idempotentes) sobre archivos que en Replit pueden estar divergentes."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def sub(text, pattern, repl, etiqueta, flags=re.S):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", etiqueta); sys.exit(1)
    return new

# 1) schema
p = root / "db/schema.ts"; s = p.read_text()
if "registrationBackground" not in s:
    s = sub(s, r'(  feedbackEnabled: boolean\("feedback_enabled"\)[^\n]*\n)', lambda m: m.group(1) + '''  baseFields: jsonb("base_fields").$type<{
    company: { label: string; required: boolean; active: boolean };
    jobTitle: { label: string; required: boolean; active: boolean };
    phone: { label: string; required: boolean; active: boolean };
  }>(),
  registrationBackground: text("registration_background"),
''', "schema")
    p.write_text(s); print("OK schema")
else:
    print("OK schema: ya aplicado")

# 2) Formulario público
p = root / "app/register/[slug]/registration-form.tsx"; s = p.read_text()
if "baseFields" not in s:
    s = sub(s, r'(import type \{ RegistrationFieldDefinition \} from "@/lib/registration-fields";\n)',
            lambda m: m.group(1) + 'import { DEFAULT_BASE_FIELDS, type BaseFieldsConfig } from "@/lib/registration-base-fields";\n', "import")
    s = sub(s, r'(  legalDocuments,\n\}: \{\n  event: PublicEvent;\n)',
            lambda m: '  legalDocuments,\n  baseFields = DEFAULT_BASE_FIELDS,\n  backgroundUrl = null,\n}: {\n  event: PublicEvent;\n  baseFields?: BaseFieldsConfig;\n  backgroundUrl?: string | null;\n', "props")
    s = sub(s, r'<section className=\{`registration-hero \$\{event\.format\}`\}>',
            lambda m: '''<section
        className={`registration-hero ${event.format}${backgroundUrl ? " with-background" : ""}`}
        style={
          backgroundUrl
            ? {
                backgroundImage: `linear-gradient(145deg, color-mix(in srgb, var(--brand-primary) 78%, transparent), color-mix(in srgb, var(--brand-accent) 62%, transparent)), url("${backgroundUrl.replace(/"/g, "%22")}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >''', "hero")
    # Para el participante todo evento es en vivo.
    s = sub(s, r'\{event\.format === "live" \? "EVENTO EN VIVO" : event\.format === "hybrid" \? "EVENTO HÍBRIDO" : "EVENTO SIMULADO"\}',
            lambda m: 'EVENTO EN VIVO', "badge")
    s = sub(s, r'(\n(\s*))<div className="public-form-row">\n\s*<label>Empresa<input name="company"[^\n]*\n\s*<label>Cargo<input name="jobTitle"[^\n]*\n\s*</div>\n\s*<label>Teléfono<input name="phone"[^\n]*\n',
            lambda m: f'''
{m.group(2)}{{(baseFields.company.active || baseFields.jobTitle.active) && (
{m.group(2)}  <div className="public-form-row">
{m.group(2)}    {{baseFields.company.active && (
{m.group(2)}      <label>{{baseFields.company.label}}{{baseFields.company.required ? " *" : ""}}<input name="company" required={{baseFields.company.required}} maxLength={{150}} autoComplete="organization" placeholder={{baseFields.company.label}} /></label>
{m.group(2)}    )}}
{m.group(2)}    {{baseFields.jobTitle.active && (
{m.group(2)}      <label>{{baseFields.jobTitle.label}}{{baseFields.jobTitle.required ? " *" : ""}}<input name="jobTitle" required={{baseFields.jobTitle.required}} maxLength={{150}} autoComplete="organization-title" placeholder={{baseFields.jobTitle.label}} /></label>
{m.group(2)}    )}}
{m.group(2)}  </div>
{m.group(2)})}}
{m.group(2)}{{baseFields.phone.active && (
{m.group(2)}  <label>{{baseFields.phone.label}}{{baseFields.phone.required ? " *" : ""}}<input name="phone" type="tel" required={{baseFields.phone.required}} maxLength={{40}} autoComplete="tel" placeholder="+57 300 000 0000" /></label>
{m.group(2)})}}
''', "campos base")
    p.write_text(s); print("OK registration-form.tsx")
else:
    print("OK registration-form.tsx: ya aplicado")

# 3) Página de registro (servidor)
p = root / "app/register/[slug]/page.tsx"; s = p.read_text()
if "registrationBackground" not in s:
    s = sub(s, r'(        brandBackgroundColor: events\.brandBackgroundColor,\n)',
            lambda m: m.group(1) + '        baseFields: events.baseFields,\n        registrationBackground: events.registrationBackground,\n', "select")
    s = sub(s, r'(      fields=\{fields\}\n)',
            lambda m: m.group(1) + '      baseFields={normalizeBaseFields(event.baseFields)}\n      backgroundUrl={event.registrationBackground ? (/^https?:\\/\\//i.test(event.registrationBackground) ? event.registrationBackground : fileUrl(event.registrationBackground)) : null}\n', "props")
    s = sub(s, r'(import \{ applyEventBrand \} from "@/lib/brand-config";\n)',
            lambda m: m.group(1) + 'import { normalizeBaseFields } from "@/lib/registration-base-fields";\nimport { fileUrl } from "@/lib/uploads";\n', "imports")
    p.write_text(s); print("OK register page.tsx")
else:
    print("OK register page.tsx: ya aplicado")

# 4) API pública de registro: campos base obligatorios
p = root / "app/api/public/events/[slug]/register/route.ts"; s = p.read_text()
if "normalizeBaseFields" not in s:
    s = sub(s, r'(\n  if \(!event\) \{\n.*?\n  \}\n)',
            lambda m: m.group(1) + '''
  // Campos base configurados por el organizador (empresa, cargo, teléfono).
  const baseFields = normalizeBaseFields(event.baseFields);
  const missingBase = (
    [
      ["company", body.company],
      ["jobTitle", body.jobTitle],
      ["phone", body.phone],
    ] as const
  ).find(([key, value]) => baseFields[key].active && baseFields[key].required && !(value ?? "").trim());
  if (missingBase) {
    return NextResponse.json(
      { error: `El campo “${baseFields[missingBase[0]].label}” es obligatorio.` },
      { status: 400 },
    );
  }
''', "validación de campos base")
    s = sub(s, r'(import \{ NextResponse[^\n]*\n)', lambda m: m.group(1) + 'import { normalizeBaseFields } from "@/lib/registration-base-fields";\n', "import")
    p.write_text(s); print("OK register/route.ts")
else:
    print("OK register/route.ts: ya aplicado")

# 5) Sala: sin mención a pregrabado
p = root / "app/room/[slug]/simulated-player.tsx"; s = p.read_text()
if "pregrabada" in s:
    s = s.replace("Gracias por acompañarnos. La transmisión pregrabada terminó.", "Gracias por acompañarnos. La transmisión ha terminado.")
    p.write_text(s); print("OK simulated-player.tsx")
else:
    print("OK simulated-player.tsx: ya aplicado")

# 6) Contenido destacado en el panel simulado
p = root / "app/events/[slug]/simulated-content-panel.tsx"; s = p.read_text()
if "sim-content-hero" not in s:
    s = sub(s, r'        <label className="post-registration-field">\n          Contenido de la biblioteca\n.*?\n        </label>\n',
            lambda m: '''        <div className={`sim-content-hero${selected ? "" : " missing"}`}>
          <span>{selected ? "▶" : "!"}</span>
          <div>
            <h3>{selected ? `Video del evento: ${selected.title}` : "Elige el video que se emitirá"}</h3>
            <p>
              {selected
                ? `${selected.durationSeconds ? `${formatDuration(selected.durationSeconds)} · ` : ""}Se emite por Amazon IVS a la hora del evento. Puedes cambiarlo hasta que empiece.`
                : assets.length === 0
                  ? "La biblioteca está vacía: sube y procesa el video en Contenidos y vuelve aquí para asignarlo. Sin video, el evento no tendrá señal."
                  : "Sin video asignado el evento no tendrá señal. Selecciónalo de la biblioteca."}
            </p>
          </div>
          <div className="sim-content-select">
            <select
              value={config?.contentAssetId ?? ""}
              disabled={busy || running}
              onChange={(e) => void saveConfig({ contentAssetId: e.target.value || null })}
            >
              <option value="">Selecciona el video de la biblioteca…</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}{asset.durationSeconds ? ` · ${formatDuration(asset.durationSeconds)}` : ""}
                </option>
              ))}
            </select>
            <Link href="/content">Gestionar biblioteca ↗</Link>
          </div>
        </div>
''', "bloque de contenido")
    s = sub(s, r'(import Link from "next/link";\n)', lambda m: m.group(1) + 'import "../registration-tools.css";\n', "import css")
    p.write_text(s); print("OK simulated-content-panel.tsx")
else:
    print("OK simulated-content-panel.tsx: ya aplicado")

# 7) Gestor de campos: campos base editables
p = root / "app/events/[slug]/registration-fields-manager.tsx"; s = p.read_text()
if "BaseFieldsConfig" not in s:
    s = sub(s, r'(\} from "@/lib/registration-fields";\n)', lambda m: m.group(1) + '''import {
  BASE_FIELD_HINTS,
  BASE_FIELD_KEYS,
  DEFAULT_BASE_FIELDS,
  type BaseFieldKey,
  type BaseFieldsConfig,
} from "@/lib/registration-base-fields";
import "../registration-tools.css";
''', "imports")
    s = sub(s, r'(  const \[type, setType\] = useState<RegistrationFieldType>\("text"\);\n)',
            lambda m: m.group(1) + '''  // Campos base (empresa, cargo, teléfono): se guardan en el evento.
  const [baseFields, setBaseFields] = useState<BaseFieldsConfig>(DEFAULT_BASE_FIELDS);
  const [baseLabels, setBaseLabels] = useState<Record<BaseFieldKey, string>>({
    company: DEFAULT_BASE_FIELDS.company.label,
    jobTitle: DEFAULT_BASE_FIELDS.jobTitle.label,
    phone: DEFAULT_BASE_FIELDS.phone.label,
  });
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventSlug}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { baseFields?: Partial<BaseFieldsConfig> | null; event?: { baseFields?: Partial<BaseFieldsConfig> | null } } } | null) => {
        if (cancelled) return;
        const stored = payload?.data?.event?.baseFields ?? payload?.data?.baseFields ?? null;
        const merged: BaseFieldsConfig = {
          company: { ...DEFAULT_BASE_FIELDS.company, ...(stored?.company ?? {}) },
          jobTitle: { ...DEFAULT_BASE_FIELDS.jobTitle, ...(stored?.jobTitle ?? {}) },
          phone: { ...DEFAULT_BASE_FIELDS.phone, ...(stored?.phone ?? {}) },
        };
        setBaseFields(merged);
        setBaseLabels({ company: merged.company.label, jobTitle: merged.jobTitle.label, phone: merged.phone.label });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventSlug]);
  const patchBaseField = async (key: BaseFieldKey, changes: Partial<BaseFieldsConfig[BaseFieldKey]>) => {
    setSaving(`base-${key}`);
    setError("");
    setNotice("");
    const response = await fetch(`/api/events/${eventSlug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseFields: { [key]: changes } }),
    });
    const payload = (await response.json()) as { error?: string };
    if (response.ok) {
      setBaseFields((current) => {
        const next = { ...current, [key]: { ...current[key], ...changes } };
        if (!next[key].active) next[key].required = false;
        return next;
      });
      setNotice(`Campo “${changes.label ?? baseFields[key].label}” actualizado.`);
    } else {
      setError(payload.error ?? "No fue posible actualizar el campo.");
    }
    setSaving("");
  };
''', "estado de campos base")
    s = sub(s, r'      <div className="registration-base-fields">\n.*?\n      </div>\n(?=\s*\{loading \?)',
            lambda m: '''      <div className="registration-base-fields editable">
        {(["Nombre completo", "Correo electrónico"] as const).map((label) => (
          <span className="base-field-card" key={label}>
            <i>Obligatorio</i>
            <b>{label}</b>
            <small>Siempre se solicita: identifica al asistente y recibe su enlace de acceso.</small>
          </span>
        ))}
        {BASE_FIELD_KEYS.map((key) => {
          const field = baseFields[key];
          const busy = saving === `base-${key}`;
          return (
            <span className={`base-field-card${field.active ? "" : " inactive"}`} key={key}>
              <i>{!field.active ? "Retirado" : field.required ? "Obligatorio" : "Opcional"}</i>
              <input
                type="text"
                aria-label={`Etiqueta del campo ${DEFAULT_BASE_FIELDS[key].label}`}
                value={baseLabels[key]}
                maxLength={60}
                disabled={busy || !field.active}
                onChange={(input) => setBaseLabels((current) => ({ ...current, [key]: input.target.value }))}
                onBlur={() => {
                  const label = baseLabels[key].trim();
                  if (label.length >= 2 && label !== field.label) void patchBaseField(key, { label });
                  else setBaseLabels((current) => ({ ...current, [key]: field.label }));
                }}
              />
              <small>{BASE_FIELD_HINTS[key]}</small>
              <span className="base-field-actions">
                <button type="button" disabled={busy || !field.active} onClick={() => void patchBaseField(key, { required: !field.required })}>
                  {field.required ? "Hacer opcional" : "Hacer obligatorio"}
                </button>
                <button type="button" className={field.active ? "danger" : ""} disabled={busy} onClick={() => void patchBaseField(key, { active: !field.active })}>
                  {field.active ? "Quitar del formulario" : "Volver a incluir"}
                </button>
              </span>
            </span>
          );
        })}
      </div>
''', "campos base")
    s = s.replace("Nombre, correo, empresa, cargo y teléfono ya están incluidos. Agrega\n            preguntas propias para segmentar a la audiencia.",
                  "Nombre y correo son fijos. Empresa, cargo y teléfono se pueden renombrar,\n            hacer obligatorios o quitar. Agrega preguntas propias para segmentar a la audiencia.")
    p.write_text(s); print("OK registration-fields-manager.tsx")
else:
    print("OK registration-fields-manager.tsx: ya aplicado")

# 8) Detalle del evento: compartir + fondo
p = root / "app/events/[slug]/event-detail.tsx"; s = p.read_text()
if "ShareRegistration" not in s:
    s = sub(s, r'(import ZoomLivestreamPanel from "\./zoom-livestream-panel";\n)',
            lambda m: m.group(1) + 'import ShareRegistration from "./share-registration";\nimport RegistrationBackgroundPanel from "./registration-background-panel";\n', "imports")
    s = sub(s, r'(<div className="public-link-box">.*?</div>\n)',
            lambda m: m.group(1) + '              <ShareRegistration slug={event.slug} title={event.title} />\n', "compartir")
    s = sub(s, r'(<section className="panel event-brand-card">.*?)(\n          </section>)',
            lambda m: m.group(1) + '\n            <RegistrationBackgroundPanel slug={event.slug} />' + m.group(2), "fondo")
    p.write_text(s); print("OK event-detail.tsx")
else:
    print("OK event-detail.tsx: ya aplicado")
print("LISTO registration-polish")
