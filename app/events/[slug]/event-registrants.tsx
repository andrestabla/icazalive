"use client";

import { useEffect, useMemo, useState } from "react";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

type Registrant = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: "registered" | "confirmed" | "attended" | "absent" | "cancelled";
  registeredAt: string;
  eventSlug: string;
};

const statusLabels: Record<Registrant["status"], string> = {
  registered: "Registrado",
  confirmed: "Confirmado",
  attended: "Asistió",
  absent: "No asistió",
  cancelled: "Cancelado",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: PLATFORM_TIMEZONE }).format(new Date(value));
}

// Inscritos de este evento: lista compacta con scroll y modal "Ver todos".
export default function EventRegistrants({ eventSlug, refreshKey = 0 }: { eventSlug: string; refreshKey?: number }) {
  const [rows, setRows] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/participants", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: Registrant[] } | null) => {
        if (cancelled) return;
        setRows((payload?.data ?? []).filter((row) => row.eventSlug === eventSlug).sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)));
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [eventSlug, refreshKey]);

  const active = useMemo(() => rows.filter((row) => row.status !== "cancelled"), [rows]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    return term ? rows.filter((row) => `${row.name} ${row.email} ${row.company ?? ""}`.toLocaleLowerCase("es").includes(term)) : rows;
  }, [rows, query]);

  const renderRow = (row: Registrant) => (
    <li key={row.id}>
      <span className="event-registrant-avatar">{row.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
      <div>
        <b>{row.name}</b>
        <small>{row.email}{row.company ? ` · ${row.company}` : ""}</small>
      </div>
      <time>{formatDate(row.registeredAt)}</time>
      <i className={`participant-status ${row.status}`}>● {statusLabels[row.status]}</i>
    </li>
  );

  return (
    <section className="panel event-registrants">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">INSCRITOS EN ESTE EVENTO</p>
          <h2>{loading ? "Cargando…" : `${active.length} inscrito${active.length === 1 ? "" : "s"}`}</h2>
        </div>
        {rows.length > 0 && (
          <button type="button" className="secondary-action" onClick={() => setOpen(true)}>Ver todos</button>
        )}
      </div>
      {!loading && rows.length === 0 ? (
        <p className="event-registrants-empty">Aún no hay inscritos. Comparte el enlace público de registro o invita participantes.</p>
      ) : (
        <ul className="event-registrants-list">{rows.slice(0, 8).map(renderRow)}</ul>
      )}
      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="modal event-registrants-modal" role="dialog" aria-modal="true" aria-labelledby="event-registrants-title" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
            <p className="eyebrow">INSCRITOS EN ESTE EVENTO</p>
            <h2 id="event-registrants-title">{rows.length} registro{rows.length === 1 ? "" : "s"}</h2>
            <input className="event-registrants-search" placeholder="Buscar por nombre, correo o empresa" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="event-registrants-list full">{filtered.map(renderRow)}</ul>
          </section>
        </div>
      )}
    </section>
  );
}
