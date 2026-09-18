"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type {
  RegistrationFieldDefinition,
  RegistrationFieldType,
} from "@/lib/registration-fields";
import {
  BASE_FIELD_HINTS,
  BASE_FIELD_KEYS,
  DEFAULT_BASE_FIELDS,
  type BaseFieldKey,
  type BaseFieldsConfig,
} from "@/lib/registration-base-fields";
import "../registration-tools.css";
import { useFeedbackSetter } from "@/lib/feedback";

const fieldTypeLabels: Record<RegistrationFieldType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  select: "Lista de opciones",
  checkbox: "Casilla de aceptación",
};

export default function RegistrationFieldsManager({
  eventSlug,
}: {
  eventSlug: string;
}) {
  const [fields, setFields] = useState<RegistrationFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setErrorState] = useState("");
  const setError = useFeedbackSetter(setErrorState, "error");
  const [notice, setNoticeState] = useState("");
  const setNotice = useFeedbackSetter(setNoticeState);
  const [editorOpen, setEditorOpen] = useState(false);
  // Edición de un campo base (etiqueta y obligatoriedad) en modal.
  const [baseDraft, setBaseDraft] = useState<{ key: BaseFieldKey; label: string; required: boolean } | null>(null);
  const [type, setType] = useState<RegistrationFieldType>("text");
  // Campos base (empresa, cargo, teléfono): se guardan en el evento.
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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventSlug}/registration-fields`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: RegistrationFieldDefinition[];
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(
            payload.error ?? "No fue posible cargar los campos del registro.",
          );
        }
        if (!cancelled) setFields(payload.data);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No fue posible cargar los campos del registro.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventSlug]);

  const createField = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    const formElement = formEvent.currentTarget;
    setSaving("new");
    setError("");
    setNotice("");
    const form = new FormData(formElement);
    const response = await fetch(
      `/api/events/${eventSlug}/registration-fields`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: form.get("label"),
          type,
          placeholder: form.get("placeholder"),
          helpText: form.get("helpText"),
          required: form.get("required") === "on",
          options: form.get("options"),
        }),
      },
    );
    const payload = (await response.json()) as {
      data?: RegistrationFieldDefinition;
      error?: string;
    };
    if (response.ok && payload.data) {
      setFields((items) => [...items, payload.data!]);
      setNotice(`Campo “${payload.data.label}” agregado al formulario.`);
      setEditorOpen(false);
      setType("text");
      formElement.reset();
    } else {
      setError(payload.error ?? "No fue posible crear el campo.");
    }
    setSaving("");
  };

  const updateField = async (
    field: RegistrationFieldDefinition,
    changes: Partial<Pick<RegistrationFieldDefinition, "active" | "required">>,
  ) => {
    setSaving(field.id);
    setError("");
    setNotice("");
    const response = await fetch(
      `/api/events/${eventSlug}/registration-fields`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: field.id, ...changes }),
      },
    );
    const payload = (await response.json()) as {
      data?: RegistrationFieldDefinition;
      error?: string;
    };
    if (response.ok && payload.data) {
      setFields((items) =>
        items.map((item) =>
          item.id === payload.data!.id ? payload.data! : item,
        ),
      );
      setNotice(`Campo “${payload.data.label}” actualizado.`);
    } else {
      setError(payload.error ?? "No fue posible actualizar el campo.");
    }
    setSaving("");
  };

  const deleteField = async (field: RegistrationFieldDefinition) => {
    if (
      !window.confirm(
        `¿Eliminar “${field.label}”? También se eliminarán sus respuestas guardadas.`,
      )
    ) {
      return;
    }
    setSaving(field.id);
    setError("");
    setNotice("");
    const response = await fetch(
      `/api/events/${eventSlug}/registration-fields`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: field.id }),
      },
    );
    const payload = (await response.json()) as { error?: string };
    if (response.ok) {
      setFields((items) => items.filter((item) => item.id !== field.id));
      setNotice(`Campo “${field.label}” eliminado.`);
    } else {
      setError(payload.error ?? "No fue posible eliminar el campo.");
    }
    setSaving("");
  };

  return (
    <section className="panel registration-fields-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">FORMULARIO</p>
          <h2>Campos de inscripción</h2>
          <p>
            Nombre y correo son fijos. Empresa, cargo y teléfono se pueden renombrar,
            hacer obligatorios o quitar. Agrega preguntas propias para segmentar a la audiencia.
          </p>
        </div>
        <button
          className="secondary-action"
          onClick={() => setEditorOpen((open) => !open)}
        >
          {editorOpen ? "Cerrar" : "+ Agregar campo"}
        </button>
      </div>

      {notice && <div className="detail-message">{notice}</div>}
      {error && <div className="participant-error">ⓘ {error}</div>}

      {editorOpen && (
        <div className="modal-backdrop" onMouseDown={() => setEditorOpen(false)}>
        <section className="modal field-editor-modal" role="dialog" aria-modal="true" aria-labelledby="field-editor-title" onMouseDown={(click) => click.stopPropagation()}>
        <button className="modal-close" onClick={() => setEditorOpen(false)} aria-label="Cerrar">×</button>
        <p className="eyebrow">NUEVO CAMPO</p>
        <h2 id="field-editor-title">Agregar campo al formulario</h2>
        <form className="registration-field-editor" onSubmit={createField}>
          <label>
            Etiqueta del campo
            <input
              name="label"
              required
              minLength={2}
              maxLength={120}
              placeholder="Ej. ¿Cuál es tu principal desafío?"
            />
          </label>
          <label>
            Tipo de respuesta
            <select
              value={type}
              onChange={(input) =>
                setType(input.target.value as RegistrationFieldType)
              }
            >
              {Object.entries(fieldTypeLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          {type !== "checkbox" && (
            <label>
              Texto de ayuda dentro del campo
              <input
                name="placeholder"
                maxLength={180}
                placeholder="Opcional"
              />
            </label>
          )}
          {type === "select" && (
            <label className="registration-options-input">
              Opciones
              <textarea
                name="options"
                required
                placeholder={"Una opción por línea\nOpción 1\nOpción 2"}
              />
              <small>Escribe al menos dos opciones, una por línea.</small>
            </label>
          )}
          <label className="registration-editor-wide">
            Descripción o aclaración
            <input name="helpText" maxLength={300} placeholder="Opcional" />
          </label>
          <label className="registration-required-toggle">
            <input name="required" type="checkbox" />
            Solicitar respuesta obligatoria
          </label>
          <button className="primary-button" disabled={saving === "new"}>
            {saving === "new" ? "Agregando…" : "Agregar al formulario"}
          </button>
        </form>
        </section>
        </div>
      )}

      {baseDraft && (
        <div className="modal-backdrop" onMouseDown={() => setBaseDraft(null)}>
          <section className="modal field-editor-modal" role="dialog" aria-modal="true" aria-labelledby="base-field-title" onMouseDown={(click) => click.stopPropagation()}>
            <button className="modal-close" onClick={() => setBaseDraft(null)} aria-label="Cerrar">×</button>
            <p className="eyebrow">CAMPO DEL FORMULARIO</p>
            <h2 id="base-field-title">Editar “{DEFAULT_BASE_FIELDS[baseDraft.key].label}”</h2>
            <label className="registration-editor-wide">
              Etiqueta que verá el asistente
              <input
                type="text"
                value={baseDraft.label}
                minLength={2}
                maxLength={60}
                onChange={(input) => setBaseDraft((current) => (current ? { ...current, label: input.target.value } : current))}
              />
            </label>
            <label className="registration-required-toggle">
              <input
                type="checkbox"
                checked={baseDraft.required}
                onChange={(input) => setBaseDraft((current) => (current ? { ...current, required: input.target.checked } : current))}
              />
              Solicitar respuesta obligatoria
            </label>
            <div className="export-actions">
              <button type="button" className="secondary-action" onClick={() => setBaseDraft(null)}>Cancelar</button>
              <button
                type="button"
                className="primary-button"
                disabled={saving !== "" || baseDraft.label.trim().length < 2}
                onClick={() => {
                  const draft = baseDraft;
                  void patchBaseField(draft.key, { label: draft.label.trim(), required: draft.required }).then(() => setBaseDraft(null));
                }}
              >
                Guardar cambios
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="registration-base-fields editable">
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
              <b>{field.label}</b>
              <small>{BASE_FIELD_HINTS[key]}</small>
              <span className="base-field-actions">
                <button type="button" disabled={busy || !field.active} onClick={() => { setBaseDraft({ key, label: field.label, required: field.required }); }}>
                  Editar
                </button>
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

      {loading ? (
        <p className="registration-fields-empty">Cargando campos…</p>
      ) : fields.length === 0 ? (
        <p className="registration-fields-empty">
          Aún no hay campos personalizados. El formulario utiliza los cinco
          campos base.
        </p>
      ) : (
        <div className="registration-custom-list">
          {fields.map((field) => (
            <article className={!field.active ? "inactive" : ""} key={field.id}>
              <span>{field.type === "checkbox" ? "✓" : field.type === "select" ? "⌄" : field.type === "textarea" ? "¶" : "Aa"}</span>
              <div>
                <b>{field.label}</b>
                <p>
                  {fieldTypeLabels[field.type]} ·{" "}
                  {field.required ? "Obligatorio" : "Opcional"}
                </p>
                {field.type === "select" && (
                  <small>{field.options.join(" · ")}</small>
                )}
              </div>
              <div className="registration-field-actions">
                <button
                  disabled={saving === field.id}
                  onClick={() =>
                    void updateField(field, { required: !field.required })
                  }
                >
                  {field.required ? "Hacer opcional" : "Hacer obligatorio"}
                </button>
                <button
                  disabled={saving === field.id}
                  onClick={() =>
                    void updateField(field, { active: !field.active })
                  }
                >
                  {field.active ? "Desactivar" : "Activar"}
                </button>
                <button
                  className="danger"
                  disabled={saving === field.id}
                  onClick={() => void deleteField(field)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
