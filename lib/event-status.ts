export type EventStatus =
  | "draft"
  | "registration_open"
  | "preparing"
  | "live"
  | "completed"
  | "cancelled";

export const eventStatusLabels: Record<EventStatus, string> = {
  draft: "Borrador",
  registration_open: "Registro abierto",
  preparing: "En preparación",
  live: "En vivo",
  completed: "Completado",
  cancelled: "Cancelado",
};

// Matriz estricta de transiciones: desde cada estado solo se permite avanzar
// a los estados listados. "completed" es terminal; "cancelled" solo puede
// recuperarse como borrador.
export const eventStatusTransitions: Record<EventStatus, EventStatus[]> = {
  draft: ["registration_open", "preparing", "cancelled"],
  registration_open: ["preparing", "live", "cancelled"],
  preparing: ["registration_open", "live", "cancelled"],
  live: ["completed", "cancelled"],
  completed: [],
  cancelled: ["draft"],
};

// Transiciones que exigen confirmación explícita del usuario por su impacto.
export const confirmableTransitions: Partial<
  Record<EventStatus, { title: string; description: string }>
> = {
  registration_open: {
    title: "Publicar el registro",
    description:
      "El evento quedará visible en la página pública y cualquier persona con el enlace podrá inscribirse.",
  },
  live: {
    title: "Iniciar el evento",
    description:
      "La sala pasará a EN VIVO para todos los participantes registrados. Verifica antes la preparación técnica.",
  },
  completed: {
    title: "Completar el evento",
    description:
      "El evento se marcará como finalizado. Esta acción es definitiva: no podrá volver a un estado anterior.",
  },
  cancelled: {
    title: "Cancelar el evento",
    description:
      "Se cerrará el registro y la sala dejará de estar disponible. Solo podrá recuperarse como borrador.",
  },
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return from === to || eventStatusTransitions[from]?.includes(to) === true;
}
