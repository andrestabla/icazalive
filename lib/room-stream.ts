import { and, count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { eventChatMessages, eventQuestions, eventReactions } from "@/db/schema";

// Difusión de la actividad de sala por SSE.
//
// Antes cada cliente recibía un aviso vacío y respondía pidiendo la sala
// entera: con miles de asistentes, un solo mensaje de chat provocaba miles de
// peticiones simultáneas, cada una con una decena de consultas. Ahora hay un
// único observador por evento y proceso que consulta lo nuevo y reparte el
// dato ya resuelto a los suscriptores de ese proceso. La carga deja de
// depender de la audiencia y pasa a depender solo de los eventos activos.
//
// Como el observador lee de la base de datos (y no de un emisor en memoria),
// también funciona con varias instancias: lo que se escribe en una llega a los
// asistentes conectados a las demás.

const POLL_MS = 2_000;
const CHAT_LIMIT = 40;
const QUESTION_LIMIT = 40;

type Subscriber = (data: string) => void;

type Watcher = {
  subscribers: Set<Subscriber>;
  timer: ReturnType<typeof setInterval> | null;
  lastChatAt: Date | null;
  lastQuestionAt: Date | null;
  // PostgreSQL guarda los instantes con microsegundos y el driver los entrega
  // redondeados a milisegundos: comparar "posterior a la última marca" vuelve a
  // encontrar la misma fila una y otra vez. Se recuerdan los identificadores ya
  // difundidos para no repetir nada.
  seenChat: Set<string>;
  seenQuestions: Set<string>;
  reactionsSignature: string | null;
  running: boolean;
};

const SEEN_LIMIT = 400;

function remember(seen: Set<string>, ids: string[]) {
  for (const id of ids) seen.add(id);
  if (seen.size <= SEEN_LIMIT) return;
  const excess = seen.size - SEEN_LIMIT;
  let removed = 0;
  for (const id of seen) {
    seen.delete(id);
    if (++removed >= excess) break;
  }
}

const globalStore = globalThis as unknown as {
  __icazaRoomWatchers?: Map<string, Watcher>;
};

function watchers() {
  if (!globalStore.__icazaRoomWatchers) {
    globalStore.__icazaRoomWatchers = new Map();
  }
  return globalStore.__icazaRoomWatchers;
}

function broadcast(watcher: Watcher, payload: unknown) {
  const data = JSON.stringify(payload);
  for (const subscriber of watcher.subscribers) {
    try {
      subscriber(data);
    } catch {
      // El propio suscriptor se da de baja cuando su conexión falla.
    }
  }
}

async function tick(eventId: string, watcher: Watcher) {
  if (watcher.running || watcher.subscribers.size === 0) return;
  watcher.running = true;
  try {
    const db = getDb();

    // Chat: solo los mensajes posteriores al último visto.
    const chatRows = await db
      .select({
        id: eventChatMessages.id,
        authorName: eventChatMessages.authorName,
        message: eventChatMessages.message,
        createdAt: eventChatMessages.createdAt,
      })
      .from(eventChatMessages)
      .where(
        and(
          eq(eventChatMessages.eventId, eventId),
          eq(eventChatMessages.channel, "public"),
          eq(eventChatMessages.status, "visible"),
          ...(watcher.lastChatAt
            ? [gte(eventChatMessages.createdAt, watcher.lastChatAt)]
            : []),
        ),
      )
      .orderBy(desc(eventChatMessages.createdAt))
      .limit(CHAT_LIMIT);

    if (chatRows.length) {
      const first = watcher.lastChatAt === null;
      watcher.lastChatAt = chatRows[0].createdAt;
      const fresh = chatRows.filter((row) => !watcher.seenChat.has(row.id));
      remember(watcher.seenChat, chatRows.map((row) => row.id));
      if (!first && fresh.length) {
        broadcast(watcher, {
          type: "chat",
          messages: fresh.map((row) => ({
            id: row.id,
            authorName: row.authorName,
            message: row.message,
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
    }

    // Preguntas nuevas: se avisa sin cuerpo porque el panel necesita también
    // los votos del propio participante, que son distintos para cada uno.
    const questionRows = await db
      .select({ id: eventQuestions.id, createdAt: eventQuestions.createdAt })
      .from(eventQuestions)
      .where(
        and(
          eq(eventQuestions.eventId, eventId),
          ...(watcher.lastQuestionAt
            ? [gte(eventQuestions.createdAt, watcher.lastQuestionAt)]
            : []),
        ),
      )
      .orderBy(desc(eventQuestions.createdAt))
      .limit(QUESTION_LIMIT);

    if (questionRows.length) {
      const first = watcher.lastQuestionAt === null;
      watcher.lastQuestionAt = questionRows[0].createdAt;
      const fresh = questionRows.filter((row) => !watcher.seenQuestions.has(row.id));
      remember(watcher.seenQuestions, questionRows.map((row) => row.id));
      if (!first && fresh.length) {
        broadcast(watcher, { type: "refresh", reason: "question" });
      }
    }

    // Reacciones: el agregado es diminuto, así que viaja completo.
    const reactionRows = await db
      .select({ reaction: eventReactions.reaction, count: count(eventReactions.id) })
      .from(eventReactions)
      .where(eq(eventReactions.eventId, eventId))
      .groupBy(eventReactions.reaction);

    const reactions = reactionRows
      .map((row) => ({ reaction: row.reaction, count: Number(row.count) }))
      .sort((a, b) => a.reaction.localeCompare(b.reaction));
    const signature = JSON.stringify(reactions);
    if (watcher.reactionsSignature === null) {
      watcher.reactionsSignature = signature;
    } else if (signature !== watcher.reactionsSignature) {
      watcher.reactionsSignature = signature;
      broadcast(watcher, { type: "reactions", reactions });
    }
  } catch (error) {
    console.error("[room-stream]", error);
  } finally {
    watcher.running = false;
  }
}

export function subscribeToRoom(eventId: string, subscriber: Subscriber) {
  const store = watchers();
  let watcher = store.get(eventId);
  if (!watcher) {
    watcher = {
      subscribers: new Set(),
      timer: null,
      lastChatAt: null,
      lastQuestionAt: null,
      seenChat: new Set(),
      seenQuestions: new Set(),
      reactionsSignature: null,
      running: false,
    };
    store.set(eventId, watcher);
  }
  watcher.subscribers.add(subscriber);
  if (!watcher.timer) {
    const current = watcher;
    // La primera pasada solo fija el punto de partida: nadie recibe como
    // "nuevo" lo que ya existía antes de conectarse.
    void tick(eventId, current);
    current.timer = setInterval(() => void tick(eventId, current), POLL_MS);
  }

  return () => {
    const active = store.get(eventId);
    if (!active) return;
    active.subscribers.delete(subscriber);
    if (active.subscribers.size === 0) {
      if (active.timer) clearInterval(active.timer);
      store.delete(eventId);
    }
  };
}

// Empuje inmediato para los suscriptores de este mismo proceso: quien escribe
// ve su mensaje sin esperar al siguiente ciclo del observador.
export function nudgeRoom(eventId: string) {
  const watcher = watchers().get(eventId);
  if (watcher) void tick(eventId, watcher);
}
