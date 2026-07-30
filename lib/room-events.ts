import { EventEmitter } from "node:events";

// Emisor en memoria por proceso para notificar actividad de sala en tiempo
// real (SSE). Se cuelga de globalThis para sobrevivir al HMR en desarrollo.
const globalStore = globalThis as unknown as {
  __icazaRoomEmitter?: EventEmitter;
};

export function getRoomEmitter(): EventEmitter {
  if (!globalStore.__icazaRoomEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalStore.__icazaRoomEmitter = emitter;
  }
  return globalStore.__icazaRoomEmitter;
}

export function notifyRoomActivity(eventId: string, kind: string) {
  getRoomEmitter().emit(`room:${eventId}`, kind);
}
