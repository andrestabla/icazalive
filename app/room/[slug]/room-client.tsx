"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import PublicBrandIdentity from "@/app/components/public-brand";
import type { PublicBrand } from "@/lib/brand-config";
import IvsPlayer from "./ivs-player";
import SimulatedPlayer, { type SimulatedPlayback } from "./simulated-player";

type RoomData = {
  viewer: {
    kind: "participant" | "preview";
    name: string;
    email: string;
  };
  event: {
    title: string;
    description: string | null;
    status: string;
    timezone: string;
    startsAt: string;
    endsAt: string;
  };
  session: {
    title: string;
    streamingMode: string;
    streamingStatus: string;
    playbackUrl: string | null;
    zoomJoinUrl: string | null;
  };
  attendeeCount: number;
  simulatedPlayback: SimulatedPlayback | null;
  questions: {
    id: string;
    question: string;
    status: "pending" | "answered";
    upvotes: number;
    authorName: string;
    createdAt: string;
  }[];
  votedQuestionIds: string[];
  polls: {
    id: string;
    question: string;
    status: "open" | "closed";
    anonymous: boolean;
    selectedOptionId: string | null;
    options: {
      id: string;
      label: string;
      votes: number;
    }[];
  }[];
  messages: {
    id: string;
    authorName: string;
    message: string;
    createdAt: string;
  }[];
  resources: {
    id: string;
    title: string;
    url: string;
    kind: "link" | "file";
    position: number;
    createdAt: string;
  }[];
  reactions: {
    reaction: string;
    count: number;
  }[];
  moderation: {
    blocked: boolean;
    mutedUntil: string | null;
    reason: string | null;
  };
  serverTime: string;
};

const REACTIONS = ["👏", "❤️", "👍", "🎉", "✋"];

export default function RoomClient({
  eventShell,
  accessToken,
  brand,
}: {
  eventShell: {
    title: string;
    slug: string;
    startsAt: string;
    timezone: string;
  };
  accessToken: string | null;
  brand: PublicBrand;
}) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<
    "chat" | "questions" | "polls" | "resources"
  >("chat");
  const [question, setQuestion] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const brandStyle = {
    "--brand-primary": brand.primaryColor,
    "--brand-accent": brand.accentColor,
    "--brand-background": brand.backgroundColor,
  } as CSSProperties;

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/public/events/${eventShell.slug}/room`,
          {
            headers: accessToken
              ? { authorization: `Bearer ${accessToken}` }
              : undefined,
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          data?: RoomData;
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "No fue posible abrir la sala.");
        }
        if (!cancelled) {
          setRoom(payload.data);
          setSelectedOptions((current) => {
            const updated = { ...current };
            for (const poll of payload.data!.polls) {
              if (poll.selectedOptionId) {
                updated[poll.id] = poll.selectedOptionId;
              }
            }
            return updated;
          });
          setError("");
          setLoading(false);
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "No fue posible abrir la sala.",
          );
          setLoading(false);
        }
      }
    };

    void refresh();
    // Canal SSE: actividad nueva dispara un refresco inmediato; el sondeo
    // queda como respaldo con un intervalo más amplio cuando hay push.
    let pollMs = 2_000;
    const streamUrl = accessToken
      ? `/api/public/events/${eventShell.slug}/room/stream?access=${encodeURIComponent(accessToken)}`
      : `/api/public/events/${eventShell.slug}/room/stream`;
    const source = new EventSource(streamUrl);
    source.onopen = () => {
      pollMs = 10_000;
    };
    source.onerror = () => {
      pollMs = 2_000;
    };
    source.onmessage = (message) => {
      if (message.data !== "heartbeat") void refresh();
    };
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        void refresh().finally(schedule);
      }, pollMs);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      source.close();
    };
  }, [accessToken, eventShell.slug]);

  const postAction = async (body: Record<string, string>) => {
    if (!accessToken) {
      return { ok: false, error: "Necesitas tu enlace personal para participar." };
    }
    const response = await fetch(
      `/api/public/events/${eventShell.slug}/room`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    const payload = (await response.json()) as { error?: string };
    return {
      ok: response.ok,
      error: payload.error,
    };
  };

  const submitChat = async () => {
    if (!chatMessage.trim()) return;
    setSubmitting(true);
    setNotice("");
    const result = await postAction({
      action: "chat",
      message: chatMessage,
    });
    if (result.ok) {
      setChatMessage("");
      setNotice("Mensaje publicado.");
    } else {
      setNotice(result.error ?? "No fue posible publicar el mensaje.");
    }
    setSubmitting(false);
  };

  const submitReaction = async (reaction: string) => {
    setNotice("");
    const result = await postAction({ action: "reaction", reaction });
    if (!result.ok) {
      setNotice(result.error ?? "No fue posible enviar la reacción.");
    }
  };

  const submitQuestion = async () => {
    if (!question.trim()) return;
    setSubmitting(true);
    setNotice("");
    const result = await postAction({ action: "question", question });
    if (result.ok) {
      setQuestion("");
      setNotice("Tu pregunta quedó en la cola de moderación.");
    } else {
      setNotice(result.error ?? "No fue posible enviar la pregunta.");
    }
    setSubmitting(false);
  };

  const submitQuestionVote = async (questionId: string) => {
    setNotice("");
    // Actualización optimista: el sondeo de 2 s reconcilia con el servidor.
    setRoom((current) => {
      if (!current) return current;
      const alreadyVoted = current.votedQuestionIds.includes(questionId);
      return {
        ...current,
        votedQuestionIds: alreadyVoted
          ? current.votedQuestionIds.filter((id) => id !== questionId)
          : [...current.votedQuestionIds, questionId],
        questions: current.questions.map((item) =>
          item.id === questionId
            ? { ...item, upvotes: Math.max(0, item.upvotes + (alreadyVoted ? -1 : 1)) }
            : item,
        ),
      };
    });
    const result = await postAction({
      action: "question_vote",
      questionId,
    });
    if (!result.ok) {
      setNotice(result.error ?? "No fue posible registrar tu voto.");
    }
  };

  const submitVote = async (pollId: string) => {
    const optionId = selectedOptions[pollId];
    if (!optionId) return;
    setSubmitting(true);
    setNotice("");
    const result = await postAction({
      action: "vote",
      pollId,
      optionId,
    });
    setNotice(
      result.ok
        ? "Tu respuesta quedó registrada."
        : result.error ?? "No fue posible registrar tu respuesta.",
    );
    setSubmitting(false);
  };

  if (loading) {
    return (
      <main className="room-access-shell branded-room" style={brandStyle}>
        <div className="room-loading"><PublicBrandIdentity brand={brand} /><p>Preparando tu sala…</p></div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="room-access-shell branded-room" style={brandStyle}>
        <section className="room-access-card">
          <PublicBrandIdentity brand={brand} />
          <span>⌁</span>
          <p className="eyebrow">ACCESO A LA SALA</p>
          <h1>{eventShell.title}</h1>
          <p>{error || "Necesitas el enlace personal incluido en tu confirmación de registro."}</p>
          <Link href={`/register/${eventShell.slug}`} className="primary-button link-button">
            Ir al registro
          </Link>
        </section>
      </main>
    );
  }

  const isLive = room.event.status === "live";
  const start = new Date(room.event.startsAt);
  const now = new Date(room.serverTime);
  const minutesUntilStart = Math.max(
    0,
    Math.ceil((start.getTime() - now.getTime()) / 60_000),
  );
  const muted =
    room.moderation.mutedUntil &&
    new Date(room.moderation.mutedUntil).getTime() > now.getTime();
  const canParticipate =
    room.viewer.kind === "participant" && !room.moderation.blocked && !muted;

  return (
    <main className="participant-room branded-room" style={brandStyle}>
      <header className="room-topbar">
        <PublicBrandIdentity brand={brand} />
        <div className="room-event-name"><b>{room.event.title}</b><small>{room.session.title}</small></div>
        <div className="room-viewer">
          <span>{room.viewer.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
          <p><b>{room.viewer.name}</b><small>{room.viewer.kind === "preview" ? "Vista del organizador" : "Participante"}</small></p>
        </div>
      </header>

      {room.viewer.kind === "preview" && (
        <div className="room-preview-banner">Vista previa del organizador · Las acciones del participante están desactivadas.</div>
      )}

      <div className="room-body">
        <section className="room-main">
          <div className="room-stage">
            <div className="room-stage-head">
              <span className={isLive ? "live" : ""}>● {isLive ? "EN VIVO" : "LOBBY"}</span>
              <small>◉ {room.attendeeCount} participantes</small>
            </div>
            {room.simulatedPlayback &&
            (room.simulatedPlayback.ended ||
              (isLive && minutesUntilStart === 0)) ? (
              <SimulatedPlayer
                eventSlug={eventShell.slug}
                accessToken={accessToken}
                playback={room.simulatedPlayback}
                serverTime={room.serverTime}
                isParticipant={room.viewer.kind === "participant"}
              />
            ) : isLive && room.session.playbackUrl ? (
              <IvsPlayer playbackUrl={room.session.playbackUrl} />
            ) : isLive && room.session.zoomJoinUrl ? (
              <div className="room-video-ready">
                <span>◉</span>
                <h2>Ingresar a la sesión en Zoom</h2>
                <p>Este evento distribuye la señal directamente desde Zoom.</p>
                <a href={room.session.zoomJoinUrl} target="_blank" rel="noreferrer">Abrir Zoom ↗</a>
              </div>
            ) : (
              <div className="room-lobby">
                <span>◷</span>
                <p className="eyebrow">LA SALA ABRIRÁ PRONTO</p>
                <h1>{room.event.title}</h1>
                <p>{room.event.description}</p>
                <div>
                  <strong>{minutesUntilStart > 1_440 ? Math.ceil(minutesUntilStart / 1_440) : minutesUntilStart}</strong>
                  <span>{minutesUntilStart > 1_440 ? "días para comenzar" : "minutos para comenzar"}</span>
                </div>
              </div>
            )}
            <footer><span>{new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: room.event.timezone }).format(start)}</span><small>Interacción sincronizada cada 2 segundos</small></footer>
          </div>

          <div className="room-reaction-bar" aria-label="Reacciones rápidas">
            <p><b>Reacciona</b><small>sin saturar el chat</small></p>
            {REACTIONS.map((reaction) => (
              <button
                aria-label={`Enviar reacción ${reaction}`}
                disabled={!canParticipate}
                key={reaction}
                onClick={() => void submitReaction(reaction)}
              >
                <span>{reaction}</span>
                <small>{room.reactions.find((item) => item.reaction === reaction)?.count ?? 0}</small>
              </button>
            ))}
          </div>

          <div className="room-session-info">
            <div><span>◉</span><p><small>SESIÓN</small><b>{room.session.title}</b></p></div>
            <div><span>⌁</span><p><small>ESTADO TÉCNICO</small><b>{room.session.streamingStatus === "ready" ? "Lista localmente" : "En preparación"}</b></p></div>
            <div><span>♙</span><p><small>ASISTENTES</small><b>{room.attendeeCount} registrados</b></p></div>
          </div>
        </section>

        <aside className="room-interaction">
          <nav aria-label="Paneles de interacción">
            <button className={activePanel === "chat" ? "active" : ""} onClick={() => setActivePanel("chat")}>Chat <span>{room.messages.length}</span></button>
            <button className={activePanel === "questions" ? "active" : ""} onClick={() => setActivePanel("questions")}>Preguntas <span>{room.questions.length}</span></button>
            <button className={activePanel === "polls" ? "active" : ""} onClick={() => setActivePanel("polls")}>Encuestas <span>{room.polls.filter((poll) => poll.status === "open").length}</span></button>
            <button className={activePanel === "resources" ? "active" : ""} onClick={() => setActivePanel("resources")}>Recursos <span>{room.resources.length}</span></button>
          </nav>

          {notice && <div className="room-notice" role="status">{notice}</div>}
          {(room.moderation.blocked || muted) && (
            <div className="room-moderation-notice" role="alert">
              <b>{room.moderation.blocked ? "Participación bloqueada" : "Participación silenciada"}</b>
              <span>
                {room.moderation.reason ||
                  (muted && room.moderation.mutedUntil
                    ? `Podrás volver a participar a las ${new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone: room.event.timezone }).format(new Date(room.moderation.mutedUntil))}.`
                    : "Contacta al equipo del evento si necesitas ayuda.")}
              </span>
            </div>
          )}

          {activePanel === "chat" ? (
            <div className="room-chat-panel">
              <div className="room-chat-list" role="log" aria-live="polite" aria-label="Chat público">
                {room.messages.map((item) => (
                  <article key={item.id}>
                    <span>{item.authorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                    <div>
                      <header><b>{item.authorName}</b><small>{new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone: room.event.timezone }).format(new Date(item.createdAt))}</small></header>
                      <p>{item.message}</p>
                    </div>
                  </article>
                ))}
                {!room.messages.length && <div className="room-empty">El chat está listo. Inicia la conversación.</div>}
              </div>
              {room.viewer.kind === "participant" && (
                <div className="room-chat-form">
                  <label htmlFor="participant-chat">Mensaje público</label>
                  <div>
                    <textarea
                      id="participant-chat"
                      maxLength={500}
                      rows={2}
                      placeholder="Escribe para todas las personas…"
                      value={chatMessage}
                      onChange={(input) => setChatMessage(input.target.value)}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" && !keyboardEvent.shiftKey) {
                          keyboardEvent.preventDefault();
                          if (canParticipate && chatMessage.trim()) void submitChat();
                        }
                      }}
                    />
                    <button
                      aria-label="Publicar mensaje"
                      disabled={submitting || !canParticipate || !chatMessage.trim()}
                      onClick={() => void submitChat()}
                    >
                      {submitting ? "…" : "↑"}
                    </button>
                  </div>
                  <small>Enter para enviar · Shift + Enter para nueva línea</small>
                </div>
              )}
            </div>
          ) : activePanel === "questions" ? (
            <>
              {room.viewer.kind === "participant" && (
                <div className="room-question-form">
                  <label htmlFor="participant-question">Haz una pregunta</label>
                  <textarea id="participant-question" maxLength={500} rows={3} placeholder="Escribe tu pregunta para el presentador…" value={question} onChange={(input) => setQuestion(input.target.value)} />
                  <button disabled={submitting || !canParticipate || question.trim().length < 5} onClick={() => void submitQuestion()}>{submitting ? "Enviando…" : "Enviar pregunta"}</button>
                </div>
              )}
              <div className="room-question-list">
                {room.questions.map((item) => (
                  <article key={item.id}>
                    <header>
                      <span>{item.authorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                      <p><b>{item.authorName}</b><small>{item.status === "answered" ? "Respondida" : "En moderación"}</small></p>
                      {room.viewer.kind === "participant" ? (
                        <button
                          type="button"
                          className={`question-vote-button ${room.votedQuestionIds.includes(item.id) ? "voted" : ""}`}
                          aria-pressed={room.votedQuestionIds.includes(item.id)}
                          aria-label={room.votedQuestionIds.includes(item.id) ? "Retirar voto" : "Votar por esta pregunta"}
                          disabled={room.moderation.blocked}
                          onClick={() => void submitQuestionVote(item.id)}
                        >
                          ▲ {item.upvotes}
                        </button>
                      ) : (
                        <i>▲ {item.upvotes}</i>
                      )}
                    </header>
                    <p>{item.question}</p>
                  </article>
                ))}
                {!room.questions.length && <div className="room-empty">Sé la primera persona en enviar una pregunta.</div>}
              </div>
            </>
          ) : activePanel === "polls" ? (
            <div className="room-poll-list">
              {room.polls.map((poll) => {
                const totalVotes = poll.options.reduce((total, option) => total + option.votes, 0);
                return (
                  <article key={poll.id}>
                    <header><span className={poll.status}>{poll.status === "open" ? "ABIERTA" : "FINALIZADA"}</span><small>{totalVotes} respuestas</small></header>
                    <h2>{poll.question}</h2>
                    <div>
                      {poll.options.map((option) => {
                        const percentage = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0;
                        return (
                          <label className={selectedOptions[poll.id] === option.id ? "selected" : ""} key={option.id}>
                            <input type="radio" name={`poll-${poll.id}`} value={option.id} disabled={poll.status !== "open" || room.viewer.kind === "preview"} checked={selectedOptions[poll.id] === option.id} onChange={() => setSelectedOptions((current) => ({ ...current, [poll.id]: option.id }))} />
                            <span>{option.label}</span>
                            <b>{poll.status === "closed" || poll.selectedOptionId ? `${percentage}%` : ""}</b>
                          </label>
                        );
                      })}
                    </div>
                    {poll.status === "open" && room.viewer.kind === "participant" && (
                      <button disabled={submitting || !selectedOptions[poll.id]} onClick={() => void submitVote(poll.id)}>{poll.selectedOptionId ? "Actualizar respuesta" : "Enviar respuesta"}</button>
                    )}
                  </article>
                );
              })}
              {!room.polls.length && <div className="room-empty">No hay encuestas abiertas en este momento.</div>}
            </div>
          ) : (
            <div className="room-resource-list">
              {room.resources.map((resource) => (
                <a href={resource.url} key={resource.id} target="_blank" rel="noopener noreferrer">
                  <span>{resource.kind === "file" ? "↓" : "↗"}</span>
                  <p><b>{resource.title}</b><small>{resource.kind === "file" ? "Archivo compartido" : "Enlace externo"}</small></p>
                  <i>abrir</i>
                </a>
              ))}
              {!room.resources.length && <div className="room-empty">El equipo aún no ha compartido recursos.</div>}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
