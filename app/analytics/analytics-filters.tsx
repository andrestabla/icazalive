"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Filtros del administrador en Analítica: organizador, evento y rango de
// fechas (por fecha de inicio del evento). Se aplican por la URL, así el
// enlace se puede compartir.
export default function AnalyticsFilters({
  organizers,
  events,
  value,
}: {
  organizers: { id: string; name: string }[];
  events: { id: string; title: string }[];
  value: { organizer: string; event: string; from: string; to: string };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const active = Object.values(value).some(Boolean);

  const apply = (next: typeof draft) => {
    setDraft(next);
    const query = new URLSearchParams();
    if (next.organizer) query.set("organizer", next.organizer);
    if (next.event) query.set("event", next.event);
    if (next.from) query.set("from", next.from);
    if (next.to) query.set("to", next.to);
    const text = query.toString();
    router.push(text ? `/analytics?${text}` : "/analytics");
  };

  return (
    <section className="analytics-filters" aria-label="Filtros de analítica">
      <label className="filter-select">
        <span>Organizador</span>
        <select value={draft.organizer} onChange={(input) => apply({ ...draft, organizer: input.target.value, event: "" })}>
          <option value="">Todos</option>
          {organizers.map((organizer) => (
            <option value={organizer.id} key={organizer.id}>{organizer.name}</option>
          ))}
        </select>
      </label>
      <label className="filter-select">
        <span>Evento</span>
        <select value={draft.event} onChange={(input) => apply({ ...draft, event: input.target.value })}>
          <option value="">Todos</option>
          {events.map((event) => (
            <option value={event.id} key={event.id}>{event.title}</option>
          ))}
        </select>
      </label>
      <label className="filter-select">
        <span>Desde</span>
        <input type="date" value={draft.from} max={draft.to || undefined} onChange={(input) => apply({ ...draft, from: input.target.value })} />
      </label>
      <label className="filter-select">
        <span>Hasta</span>
        <input type="date" value={draft.to} min={draft.from || undefined} onChange={(input) => apply({ ...draft, to: input.target.value })} />
      </label>
      {active && (
        <button type="button" className="secondary-action" onClick={() => apply({ organizer: "", event: "", from: "", to: "" })}>
          Limpiar filtros
        </button>
      )}
    </section>
  );
}
