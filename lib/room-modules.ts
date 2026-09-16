// Módulos de interacción de la sala del participante. Cada evento decide
// cuáles están activos; el organizador puede encenderlos o apagarlos durante
// la transmisión y la sala se actualiza al instante por SSE.
//
// En el mismo objeto (columna events.room_modules) viaja el mensaje de cierre
// que ven los asistentes cuando el evento se completa.

export type RoomModuleKey = "chat" | "questions" | "polls" | "resources" | "reactions";
export type RoomModules = { [K in RoomModuleKey]: boolean } & { closingMessage: string };

export const ROOM_MODULE_KEYS: RoomModuleKey[] = ["chat", "questions", "polls", "resources", "reactions"];

export const DEFAULT_CLOSING_MESSAGE = "Gracias por su asistencia, pronto los contactaremos.";
export const CLOSING_MESSAGE_MAX = 400;

export const DEFAULT_ROOM_MODULES: RoomModules = {
  chat: true,
  questions: true,
  polls: true,
  resources: true,
  reactions: true,
  closingMessage: DEFAULT_CLOSING_MESSAGE,
};

export const ROOM_MODULE_LABELS: Record<RoomModuleKey, { title: string; description: string }> = {
  chat: { title: "Chat en vivo", description: "Mensajes públicos entre los asistentes y el equipo." },
  questions: { title: "Preguntas", description: "Preguntas al ponente con votos y moderación." },
  polls: { title: "Encuestas", description: "Votaciones en vivo con resultados al instante." },
  resources: { title: "Recursos", description: "Enlaces y archivos compartidos por el equipo." },
  reactions: { title: "Reacciones", description: "Aplausos y emojis rápidos sobre el video." },
};

export function normalizeClosingMessage(input: unknown): string {
  if (typeof input !== "string") return DEFAULT_CLOSING_MESSAGE;
  const trimmed = input.trim().slice(0, CLOSING_MESSAGE_MAX);
  return trimmed || DEFAULT_CLOSING_MESSAGE;
}

// Completa un objeto parcial (o inválido) con la base indicada.
export function normalizeRoomModules(
  input: unknown,
  base: RoomModules = DEFAULT_ROOM_MODULES,
): RoomModules {
  const result: RoomModules = { ...DEFAULT_ROOM_MODULES, ...base };
  if (input && typeof input === "object") {
    for (const key of ROOM_MODULE_KEYS) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === "boolean") result[key] = value;
    }
    const closing = (input as Record<string, unknown>).closingMessage;
    if (typeof closing === "string") result.closingMessage = normalizeClosingMessage(closing);
  }
  return result;
}

export function roomModulesSignature(modules: RoomModules): string {
  return `${ROOM_MODULE_KEYS.map((key) => (modules[key] ? "1" : "0")).join("")}|${modules.closingMessage}`;
}

// Acción de la sala → módulo que la habilita.
export const ROOM_ACTION_MODULE: Record<string, RoomModuleKey> = {
  chat: "chat",
  reaction: "reactions",
  question: "questions",
  question_vote: "questions",
  vote: "polls",
};
