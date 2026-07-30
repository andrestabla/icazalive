"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type EventOption = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  maxAttendees: number;
};

type ParticipantInput = {
  name: string;
  email: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
};

type InvitationResult = {
  event: { id: string; title: string; slug: string };
  summary: {
    received: number;
    created: number;
    updated: number;
    skipped: number;
    queued: number;
  };
  invitations: {
    email: string;
    name: string;
    registrationId: string;
    accessUrl: string;
    manageUrl: string;
    created: boolean;
  }[];
  skipped: { row: number; email: string; reason: string }[];
};

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvLine(line: string, separator: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === separator && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseParticipantsCsv(value: string) {
  const lines = value
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) {
    return {
      participants: [] as ParticipantInput[],
      error: "Incluye una fila de encabezados y al menos un participante.",
    };
  }
  const separator =
    (lines[0].match(/;/g)?.length ?? 0) >
    (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const headers = parseCsvLine(lines[0], separator).map(normalizeHeader);
  const findColumn = (...aliases: string[]) =>
    headers.findIndex((header) => aliases.includes(header));
  const nameIndex = findColumn("nombre", "name", "nombrecompleto");
  const emailIndex = findColumn("correo", "email", "correoelectronico");
  if (nameIndex < 0 || emailIndex < 0) {
    return {
      participants: [] as ParticipantInput[],
      error: "El CSV debe incluir las columnas nombre y correo.",
    };
  }
  const companyIndex = findColumn("empresa", "company", "organizacion");
  const jobTitleIndex = findColumn("cargo", "jobtitle", "puesto");
  const phoneIndex = findColumn("telefono", "phone", "celular");
  const participants = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line, separator);
    return {
      name: cells[nameIndex] ?? "",
      email: cells[emailIndex] ?? "",
      company: companyIndex >= 0 ? cells[companyIndex] : undefined,
      jobTitle: jobTitleIndex >= 0 ? cells[jobTitleIndex] : undefined,
      phone: phoneIndex >= 0 ? cells[phoneIndex] : undefined,
    };
  });
  return { participants, error: "" };
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

export default function ParticipantInviter({
  onImported,
}: {
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [sendInvitation, setSendInvitation] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InvitationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/events", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: EventOption[];
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(
            payload.error ?? "No fue posible cargar los eventos.",
          );
        }
        if (!cancelled) {
          const available = payload.data.filter(
            (event) =>
              event.status !== "cancelled" && event.status !== "completed",
          );
          setEvents(available);
          setEventId((current) => current || available[0]?.id || "");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No fue posible cargar los eventos.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const parsedCsv = useMemo(() => parseParticipantsCsv(csvText), [csvText]);

  const readFile = async (change: ChangeEvent<HTMLInputElement>) => {
    const file = change.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("El archivo supera el límite local de 2 MB.");
      return;
    }
    setCsvText(await file.text());
    setError("");
    setResult(null);
  };

  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setSaving(true);
    setError("");
    setResult(null);
    const form = new FormData(formEvent.currentTarget);
    const participants =
      mode === "manual"
        ? [
            {
              name: String(form.get("name") ?? ""),
              email: String(form.get("email") ?? ""),
              company: String(form.get("company") ?? ""),
              jobTitle: String(form.get("jobTitle") ?? ""),
              phone: String(form.get("phone") ?? ""),
            },
          ]
        : parsedCsv.participants;
    if (mode === "import" && parsedCsv.error) {
      setError(parsedCsv.error);
      setSaving(false);
      return;
    }

    const response = await fetch("/api/participants/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId,
        source: mode,
        sendInvitation,
        participants,
      }),
    });
    const payload = (await response.json()) as {
      data?: InvitationResult;
      error?: string;
      skipped?: InvitationResult["skipped"];
    };
    if (!response.ok || !payload.data) {
      setError(payload.error ?? "No fue posible preparar las invitaciones.");
      setSaving(false);
      return;
    }
    setResult(payload.data);
    onImported();
    setSaving(false);
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    setResult(null);
    setError("");
    setCsvText("");
    setMode("manual");
  };

  return (
    <>
      <button className="primary-button" onClick={() => setOpen(true)}>
        + Invitar participantes
      </button>
      {open && (
        <div className="modal-backdrop" onMouseDown={close}>
          <section
            className="modal participant-invite-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="participant-invite-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              disabled={saving}
              onClick={close}
              aria-label="Cerrar"
            >
              ×
            </button>
            <p className="eyebrow">CRECIMIENTO DE AUDIENCIA</p>
            <h2 id="participant-invite-title">Invitar participantes</h2>
            <p className="participant-invite-intro">
              Crea accesos personales y prepara las comunicaciones en la cola
              local.
            </p>

            <div className="participant-invite-tabs">
              <button
                className={mode === "manual" ? "active" : ""}
                onClick={() => {
                  setMode("manual");
                  setResult(null);
                  setError("");
                }}
              >
                Una persona
              </button>
              <button
                className={mode === "import" ? "active" : ""}
                onClick={() => {
                  setMode("import");
                  setResult(null);
                  setError("");
                }}
              >
                Importar CSV
              </button>
            </div>

            {result ? (
              <div className="participant-invite-result">
                <span>✓</span>
                <h3>Invitaciones preparadas</h3>
                <p>
                  {result.summary.created} nuevas · {result.summary.updated}{" "}
                  actualizadas · {result.summary.skipped} omitidas
                </p>
                <div className="invite-result-stats">
                  <div><b>{result.summary.received}</b><small>RECIBIDAS</small></div>
                  <div><b>{result.summary.queued}</b><small>EN COLA</small></div>
                  <div><b>{result.summary.skipped}</b><small>OMITIDAS</small></div>
                </div>
                {result.invitations.slice(0, 5).map((invitation) => (
                  <a
                    href={invitation.manageUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={invitation.registrationId}
                  >
                    <span>{invitation.name}<small>{invitation.email}</small></span>
                    Gestionar ↗
                  </a>
                ))}
                {result.skipped.length > 0 && (
                  <div className="invite-skipped-list">
                    {result.skipped.slice(0, 5).map((item) => (
                      <p key={`${item.row}-${item.email}`}>
                        <b>Fila {item.row}: {item.email || "sin correo"}</b>
                        <span>{item.reason}</span>
                      </p>
                    ))}
                  </div>
                )}
                <button className="primary-button" onClick={close}>Listo</button>
              </div>
            ) : (
              <form className="participant-invite-form" onSubmit={submit}>
                <label>
                  Evento
                  <select
                    value={eventId}
                    required
                    onChange={(input) => setEventId(input.target.value)}
                  >
                    {events.map((event) => (
                      <option value={event.id} key={event.id}>
                        {event.title} · {formatEventDate(event.startsAt)}
                      </option>
                    ))}
                  </select>
                </label>
                {mode === "manual" ? (
                  <div className="participant-manual-grid">
                    <label>Nombre completo *<input name="name" required minLength={2} maxLength={100} /></label>
                    <label>Correo electrónico *<input name="email" type="email" required maxLength={254} /></label>
                    <label>Empresa<input name="company" maxLength={150} /></label>
                    <label>Cargo<input name="jobTitle" maxLength={150} /></label>
                    <label className="invite-phone-field">Teléfono<input name="phone" maxLength={40} /></label>
                  </div>
                ) : (
                  <div className="participant-csv-import">
                    <label className="participant-file-picker">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(change) => void readFile(change)}
                      />
                      <span>Seleccionar archivo CSV</span>
                      <small>Máximo 2 MB · hasta 500 filas</small>
                    </label>
                    <label>
                      O pega aquí el contenido
                      <textarea
                        value={csvText}
                        onChange={(input) => {
                          setCsvText(input.target.value);
                          setResult(null);
                        }}
                        placeholder={"nombre,correo,empresa,cargo,telefono\nAna Pérez,ana@empresa.com,Empresa,Cargo,+57 300 000 0000"}
                      />
                    </label>
                    {csvText && (
                      <div className={parsedCsv.error ? "csv-preview error" : "csv-preview"}>
                        {parsedCsv.error ? (
                          <p>{parsedCsv.error}</p>
                        ) : (
                          <>
                            <b>{parsedCsv.participants.length} filas detectadas</b>
                            {parsedCsv.participants.slice(0, 4).map((participant, index) => (
                              <span key={`${participant.email}-${index}`}>
                                {participant.name || "Sin nombre"}
                                <small>{participant.email || "Sin correo"}</small>
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <label className="invite-queue-option">
                  <input
                    type="checkbox"
                    checked={sendInvitation}
                    onChange={(input) => setSendInvitation(input.target.checked)}
                  />
                  <span>
                    <b>Preparar comunicaciones automáticas</b>
                    <small>
                      La confirmación queda en cola y los recordatorios se
                      programan según el evento.
                    </small>
                  </span>
                </label>
                {error && <div className="participant-error">ⓘ {error}</div>}
                <div className="participant-invite-actions">
                  <button type="button" onClick={close}>Cancelar</button>
                  <button
                    className="primary-button"
                    disabled={
                      saving ||
                      !eventId ||
                      (mode === "import" &&
                        (!parsedCsv.participants.length || Boolean(parsedCsv.error)))
                    }
                  >
                    {saving
                      ? "Preparando…"
                      : mode === "manual"
                        ? "Crear invitación"
                        : `Importar ${parsedCsv.participants.length || ""} participantes`}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
