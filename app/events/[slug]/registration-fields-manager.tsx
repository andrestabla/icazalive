"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type {
  RegistrationFieldDefinition,
  RegistrationFieldType,
} from "@/lib/registration-fields";

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [type, setType] = useState<RegistrationFieldType>("text");

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
            Nombre, correo, empresa, cargo y teléfono ya están incluidos. Agrega
            preguntas propias para segmentar a la audiencia.
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
      )}

      <div className="registration-base-fields">
        {["Nombre completo", "Correo electrónico", "Empresa", "Cargo", "Teléfono"].map(
          (label, index) => (
            <span key={label}>
              <i>{index < 2 ? "Obligatorio" : "Base"}</i>
              {label}
              <small>Incluido</small>
            </span>
          ),
        )}
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
