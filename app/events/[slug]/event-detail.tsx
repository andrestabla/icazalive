"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { StreamingCheck, StreamingMode } from "@/lib/streaming";
import {
  confirmableTransitions,
  eventStatusTransitions,
} from "@/lib/event-status";
import EventAnalyticsPanel from "./event-analytics-panel";
import FeedbackAdminPanel from "./feedback-admin-panel";
import OrganizersPanel from "./organizers-panel";
import RecordedVideoPanel from "./recorded-video-panel";
import SimulatedContentPanel from "./simulated-content-panel";
import RegistrationFieldsManager from "./registration-fields-manager";

type EventData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  format: "live" | "simulated" | "hybrid";
  status: "draft" | "registration_open" | "preparing" | "live" | "completed" | "cancelled";
  timezone: string;
  startsAt: string;
  endsAt: string;
  maxAttendees: number;
  registrationOpen: boolean;
  selfServiceCutoffMinutes: number;
  postRegistrationUrl: string | null;
  feedbackEnabled: boolean;
  feedbackQuestion: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  brandBackgroundColor: string | null;
  postEventRedirectUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type SessionData = {
  id: string;
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  streamingMode: StreamingMode;
  streamingStatus: "not_configured" | "configured" | "ready" | "live" | "ended" | "error";
  latencyMode: "low" | "standard";
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  ivsChannelArn: string | null;
  playbackUrl: string | null;
  recordingEnabled: boolean;
  technicalCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CommunicationMessage = {
  id: string;
  eventId: string;
  type: "registration_confirmation" | "reminder_24h" | "reminder_1h" | "post_event";
  subject: string;
  body: string;
  enabled: boolean;
  offsetMinutes: number;
  createdAt: string;
  updatedAt: string;
};

type DeliveryStat = {
  status: "queued" | "scheduled" | "sent" | "failed" | "cancelled";
  total: number;
};

type InteractionQuestion = {
  id: string;
  question: string;
  status: "pending" | "answered" | "dismissed";
  upvotes: number;
  authorName: string;
  authorEmail: string | null;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PollOption = {
  id: string;
  pollId: string;
  label: string;
  position: number;
  votes: number;
};

type InteractionPoll = {
  id: string;
  eventId: string;
  question: string;
  status: "draft" | "open" | "closed";
  anonymous: boolean;
  launchedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  options: PollOption[];
};

type InteractionChatMessage = {
  id: string;
  registrationId: string | null;
  authorUserId: string | null;
  authorName: string;
  authorEmail: string | null;
  channel: "public" | "backstage";
  message: string;
  status: "visible" | "removed";
  removedAt: string | null;
  createdAt: string;
};

type InteractionResource = {
  id: string;
  eventId: string;
  title: string;
  url: string;
  kind: "link" | "file";
  visible: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

type ParticipantModeration = {
  id: string;
  registrationId: string;
  participantName: string;
  participantEmail: string;
  mutedUntil: string | null;
  blocked: boolean;
  reason: string | null;
  updatedAt: string;
};

type InteractionData = {
  questions: InteractionQuestion[];
  polls: InteractionPoll[];
  messages: InteractionChatMessage[];
  resources: InteractionResource[];
  moderations: ParticipantModeration[];
  reactions: { reaction: string; count: number }[];
  serverTime: string;
};

const statusLabels: Record<EventData["status"], string> = {
  draft: "Borrador",
  registration_open: "Registro abierto",
  preparing: "En preparación",
  live: "En vivo",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

const communicationLabels: Record<
  CommunicationMessage["type"],
  { title: string; timing: string; icon: string }
> = {
  registration_confirmation: {
    title: "Confirmación de registro",
    timing: "Inmediatamente después del registro",
    icon: "✓",
  },
  reminder_24h: {
    title: "Recordatorio de 24 horas",
    timing: "24 horas antes del evento",
    icon: "24",
  },
  reminder_1h: {
    title: "Recordatorio de 1 hora",
    timing: "1 hora antes del evento",
    icon: "1h",
  },
  post_event: {
    title: "Seguimiento posterior",
    timing: "1 hora después del evento",
    icon: "↗",
  },
};

function formatStableDateTime(
  date: Date,
  timeZone: string,
  month: "long" | "short" = "long",
) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month,
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value.replace(/\s+/g, " ") ?? "";
  return `${value("day")} de ${value("month")} de ${value("year")} · ${value("hour")}:${value("minute")} ${value("dayPeriod")}`.trim();
}

function formatStableTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value.replace(/\s+/g, " ") ?? "";
  return `${value("hour")}:${value("minute")} ${value("dayPeriod")}`.trim();
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeSession(session: SessionData): SessionData {
  return {
    ...session,
    startsAt: new Date(session.startsAt).toISOString(),
    endsAt: new Date(session.endsAt).toISOString(),
    technicalCheckAt: session.technicalCheckAt
      ? new Date(session.technicalCheckAt).toISOString()
      : null,
    createdAt: new Date(session.createdAt).toISOString(),
    updatedAt: new Date(session.updatedAt).toISOString(),
  };
}

function sortSessions(items: SessionData[]) {
  return [...items].sort(
    (first, second) =>
      new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
  );
}

export default function EventDetail({
  initialEvent,
  sessions,
  registrationCount,
  integrations,
  communications,
  deliveryStats,
  streamingChecks,
  streamingCredentials,
}: {
  initialEvent: EventData;
  sessions: SessionData[];
  registrationCount: number;
  integrations: { provider: string; status: string; accountLabel: string | null }[];
  communications: CommunicationMessage[];
  deliveryStats: DeliveryStat[];
  streamingChecks: StreamingCheck[];
  streamingCredentials: {
    zoomCredentialsConfigured: boolean;
    awsCredentialsConfigured: boolean;
    awsRegion: string;
  };
}) {
  const [event, setEvent] = useState(initialEvent);
  const [sessionItems, setSessionItems] = useState(() => sortSessions(sessions));
  const [streamingSession, setStreamingSession] = useState(
    sortSessions(sessions)[0] ?? null,
  );
  const [technicalChecks, setTechnicalChecks] = useState(streamingChecks);
  const [interactionData, setInteractionData] =
    useState<InteractionData | null>(null);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionSaving, setInteractionSaving] = useState<string | null>(null);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollOptions, setNewPollOptions] = useState(["", "", ""]);
  const [newPublicMessage, setNewPublicMessage] = useState("");
  const [newBackstageMessage, setNewBackstageMessage] = useState("");
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [newResourceKind, setNewResourceKind] =
    useState<InteractionResource["kind"]>("link");
  const [communicationItems, setCommunicationItems] = useState(communications);
  const [liveDeliveryStats, setLiveDeliveryStats] = useState(deliveryStats);
  const [selectedCommunicationId, setSelectedCommunicationId] = useState(
    communications[0]?.id ?? "",
  );
  const [activeTab, setActiveTab] = useState("Resumen");
  const [saving, setSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EventData["status"] | null>(null);
  const [communicationSaving, setCommunicationSaving] = useState(false);
  const [streamingSaving, setStreamingSaving] = useState(false);
  const [sessionEditor, setSessionEditor] = useState<
    SessionData | "new" | null
  >(null);
  const [sessionToDelete, setSessionToDelete] = useState<SessionData | null>(
    null,
  );
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (activeTab !== "Interacción") return;
    let cancelled = false;
    const refresh = () =>
      fetch(`/api/events/${event.slug}/interaction`, { cache: "no-store" })
        .then(async (response) => {
          const payload = (await response.json()) as {
            data?: InteractionData;
            error?: string;
          };
          if (!response.ok || !payload.data) {
            throw new Error(payload.error ?? "No fue posible cargar la interacción.");
          }
          if (!cancelled) setInteractionData(payload.data);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setMessage(
              error instanceof Error
                ? error.message
                : "No fue posible cargar la interacción.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setInteractionLoading(false);
        });
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeTab, event.slug]);

  const patchEvent = async (changes: Partial<Pick<EventData, "status" | "registrationOpen" | "selfServiceCutoffMinutes" | "postRegistrationUrl" | "feedbackEnabled" | "feedbackQuestion" | "brandPrimaryColor" | "brandAccentColor" | "brandBackgroundColor" | "postEventRedirectUrl">>) => {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(changes),
    });
    const payload = (await response.json()) as { data?: EventData; error?: string };
    if (response.ok && payload.data) {
      setEvent({
        ...payload.data,
        startsAt: new Date(payload.data.startsAt).toISOString(),
        endsAt: new Date(payload.data.endsAt).toISOString(),
      });
      setMessage("Cambios guardados.");
    } else {
      setMessage(payload.error ?? "No fue posible guardar los cambios.");
    }
    setSaving(false);
  };

  const selectTab = (tab: string) => {
    if (tab === "Interacción" && !interactionData) {
      setInteractionLoading(true);
    }
    setActiveTab(tab);
  };

  const refreshStreamingSession = async () => {
    const response = await fetch(`/api/events/${event.slug}/streaming`);
    const payload = (await response.json()) as {
      data?: {
        session: SessionData;
        checks: StreamingCheck[];
      };
    };
    if (!response.ok || !payload.data) return;
    const refreshed = normalizeSession(payload.data.session);
    setStreamingSession(refreshed);
    setTechnicalChecks(payload.data.checks);
    setSessionItems((items) =>
      sortSessions(
        items.map((item) => (item.id === refreshed.id ? refreshed : item)),
      ),
    );
  };

  const saveSession = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!sessionEditor) return;
    setSessionSaving(true);
    setSessionError("");
    setMessage("");

    const form = new FormData(formEvent.currentTarget);
    const startsAt = new Date(String(form.get("startsAt")));
    const endsAt = new Date(String(form.get("endsAt")));
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      setSessionError("La hora de finalización debe ser posterior al inicio.");
      setSessionSaving(false);
      return;
    }

    const editing = sessionEditor !== "new" ? sessionEditor : null;
    const response = await fetch(`/api/events/${event.slug}/sessions`, {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(editing ? { id: editing.id } : {}),
        title: form.get("title"),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }),
    });
    const payload = (await response.json()) as {
      data?: SessionData;
      error?: string;
    };

    if (response.ok && payload.data) {
      const stored = normalizeSession(payload.data);
      setSessionItems((items) =>
        sortSessions(
          editing
            ? items.map((item) => (item.id === stored.id ? stored : item))
            : [...items, stored],
        ),
      );
      setSessionEditor(null);
      setMessage(
        editing
          ? "Sesión actualizada. Si cambió el horario, ejecuta nuevamente la revisión técnica."
          : "Sesión añadida a la agenda.",
      );
      await refreshStreamingSession();
    } else {
      setSessionError(payload.error ?? "No fue posible guardar la sesión.");
    }
    setSessionSaving(false);
  };

  const deleteSession = async () => {
    if (!sessionToDelete) return;
    setSessionSaving(true);
    setSessionError("");
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/sessions`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: sessionToDelete.id }),
    });
    const payload = (await response.json()) as {
      data?: { id: string };
      error?: string;
    };
    if (response.ok && payload.data) {
      setSessionItems((items) =>
        items.filter((item) => item.id !== payload.data?.id),
      );
      setSessionToDelete(null);
      setSessionEditor(null);
      setMessage("Sesión eliminada de la agenda.");
      await refreshStreamingSession();
    } else {
      setSessionError(payload.error ?? "No fue posible eliminar la sesión.");
    }
    setSessionSaving(false);
  };

  const patchCommunication = async (
    messageId: string,
    changes: Partial<Pick<CommunicationMessage, "enabled" | "subject" | "body">>,
  ) => {
    setCommunicationSaving(true);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/communications`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, ...changes }),
    });
    const payload = (await response.json()) as {
      data?: CommunicationMessage;
      error?: string;
    };
    if (response.ok && payload.data) {
      setCommunicationItems((items) =>
        items.map((item) =>
          item.id === payload.data?.id
            ? {
                ...payload.data,
                createdAt: new Date(payload.data.createdAt).toISOString(),
                updatedAt: new Date(payload.data.updatedAt).toISOString(),
              }
            : item,
        ),
      );
      setMessage("Comunicación guardada.");
    } else {
      setMessage(payload.error ?? "No fue posible guardar la comunicación.");
    }
    setCommunicationSaving(false);
  };

  const saveStreamingConfiguration = async (
    action: "save" | "run_check",
  ) => {
    if (!streamingSession) return;
    setStreamingSaving(true);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/streaming`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: streamingSession.id,
        action,
        streamingMode: streamingSession.streamingMode,
        latencyMode: streamingSession.latencyMode,
        zoomMeetingId: streamingSession.zoomMeetingId,
        zoomJoinUrl: streamingSession.zoomJoinUrl,
        ivsChannelArn: streamingSession.ivsChannelArn,
        playbackUrl: streamingSession.playbackUrl,
        recordingEnabled: streamingSession.recordingEnabled,
      }),
    });
    const payload = (await response.json()) as {
      data?: {
        session: SessionData;
        checks: StreamingCheck[];
      };
      error?: string;
    };
    if (response.ok && payload.data) {
      const stored = normalizeSession(payload.data.session);
      setStreamingSession(stored);
      setSessionItems((items) =>
        items.map((item) => (item.id === stored.id ? stored : item)),
      );
      setTechnicalChecks(payload.data.checks);
      setMessage(
        action === "run_check"
          ? payload.data.checks.some((check) => check.status === "fail")
            ? "La revisión encontró elementos pendientes."
            : "Configuración técnica validada localmente."
          : "Configuración de transmisión guardada.",
      );
    } else {
      setMessage(payload.error ?? "No fue posible guardar la transmisión.");
    }
    setStreamingSaving(false);
  };

  const updateQuestionStatus = async (
    questionId: string,
    status: InteractionQuestion["status"],
  ) => {
    setInteractionSaving(questionId);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/interaction`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "question",
        id: questionId,
        status,
      }),
    });
    const payload = (await response.json()) as {
      data?: { status: InteractionQuestion["status"]; answeredAt: string | null };
      error?: string;
    };
    if (response.ok && payload.data) {
      setInteractionData((current) =>
        current
          ? {
              ...current,
              questions: current.questions.map((question) =>
                question.id === questionId
                  ? {
                      ...question,
                      status: payload.data!.status,
                      answeredAt: payload.data!.answeredAt,
                    }
                  : question,
              ),
            }
          : current,
      );
      setMessage("Estado de la pregunta actualizado.");
    } else {
      setMessage(payload.error ?? "No fue posible actualizar la pregunta.");
    }
    setInteractionSaving(null);
  };

  const updatePollStatus = async (
    pollId: string,
    action: "open" | "close",
  ) => {
    setInteractionSaving(pollId);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/interaction`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity: "poll", id: pollId, action }),
    });
    const payload = (await response.json()) as {
      data?: {
        status: InteractionPoll["status"];
        launchedAt: string | null;
        closedAt: string | null;
      };
      error?: string;
    };
    if (response.ok && payload.data) {
      setInteractionData((current) =>
        current
          ? {
              ...current,
              polls: current.polls.map((poll) =>
                poll.id === pollId
                  ? {
                      ...poll,
                      status: payload.data!.status,
                      launchedAt: payload.data!.launchedAt,
                      closedAt: payload.data!.closedAt,
                    }
                  : poll,
              ),
            }
          : current,
      );
      setMessage(
        action === "open" ? "Encuesta abierta." : "Encuesta cerrada.",
      );
    } else {
      setMessage(payload.error ?? "No fue posible actualizar la encuesta.");
    }
    setInteractionSaving(null);
  };

  const createPoll = async () => {
    const options = newPollOptions.map((option) => option.trim()).filter(Boolean);
    if (!newPollQuestion.trim() || options.length < 2) {
      setMessage("Escribe una pregunta y al menos dos opciones.");
      return;
    }
    setInteractionSaving("new-poll");
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/interaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: newPollQuestion,
        options,
        anonymous: true,
      }),
    });
    const payload = (await response.json()) as {
      data?: InteractionPoll;
      error?: string;
    };
    if (response.ok && payload.data) {
      setInteractionData((current) =>
        current
          ? { ...current, polls: [payload.data!, ...current.polls] }
          : current,
      );
      setNewPollQuestion("");
      setNewPollOptions(["", "", ""]);
      setMessage("Encuesta creada como borrador.");
    } else {
      setMessage(payload.error ?? "No fue posible crear la encuesta.");
    }
    setInteractionSaving(null);
  };

  const sendStaffMessage = async (
    channel: InteractionChatMessage["channel"],
  ) => {
    const value =
      channel === "public" ? newPublicMessage : newBackstageMessage;
    if (!value.trim()) return;
    const savingKey = `new-${channel}-message`;
    setInteractionSaving(savingKey);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/interaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "message",
        channel,
        message: value,
      }),
    });
    const payload = (await response.json()) as {
      data?: InteractionChatMessage;
      error?: string;
    };
    if (response.ok && payload.data) {
      setInteractionData((current) =>
        current
          ? { ...current, messages: [payload.data!, ...current.messages] }
          : current,
      );
      if (channel === "public") setNewPublicMessage("");
      else setNewBackstageMessage("");
      setMessage(
        channel === "public"
          ? "Anuncio publicado en el chat."
          : "Mensaje enviado al canal privado.",
      );
    } else {
      setMessage(payload.error ?? "No fue posible enviar el mensaje.");
    }
    setInteractionSaving(null);
  };

  const createResource = async () => {
    if (!newResourceTitle.trim() || !newResourceUrl.trim()) {
      setMessage("Incluye el título y la URL del recurso.");
      return;
    }
    setInteractionSaving("new-resource");
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/interaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: "resource",
        title: newResourceTitle,
        url: newResourceUrl,
        kind: newResourceKind,
      }),
    });
    const payload = (await response.json()) as {
      data?: InteractionResource;
      error?: string;
    };
    if (response.ok && payload.data) {
      setInteractionData((current) =>
        current
          ? { ...current, resources: [...current.resources, payload.data!] }
          : current,
      );
      setNewResourceTitle("");
      setNewResourceUrl("");
      setMessage("Recurso agregado y visible en la sala.");
    } else {
      setMessage(payload.error ?? "No fue posible agregar el recurso.");
    }
    setInteractionSaving(null);
  };

  const patchLiveInteraction = async (
    key: string,
    body: Record<string, string>,
    successMessage: string,
  ) => {
    setInteractionSaving(key);
    setMessage("");
    const response = await fetch(`/api/events/${event.slug}/interaction`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? successMessage
        : payload.error ?? "No fue posible completar la acción.",
    );
    setInteractionSaving(null);
  };

  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const zoom = integrations.find((item) => item.provider === "zoom");
  const ivs = integrations.find((item) => item.provider === "amazon_ivs");
  const streamingStatusLabels: Record<
    NonNullable<typeof streamingSession>["streamingStatus"],
    string
  > = {
    not_configured: "Pendiente",
    configured: "Configurada",
    ready: "Lista localmente",
    live: "En vivo",
    ended: "Finalizada",
    error: "Con error",
  };
  const passedChecks = technicalChecks.filter(
    (check) => check.status !== "fail",
  ).length;
  const streamingProgress = technicalChecks.length
    ? Math.round((passedChecks / technicalChecks.length) * 100)
    : 0;
  const pendingQuestions =
    interactionData?.questions.filter((question) => question.status === "pending")
      .length ?? 0;
  const openPolls =
    interactionData?.polls.filter((poll) => poll.status === "open").length ?? 0;
  const totalPollVotes =
    interactionData?.polls.reduce(
      (total, poll) =>
        total +
        poll.options.reduce(
          (pollTotal, option) => pollTotal + option.votes,
          0,
        ),
      0,
    ) ?? 0;
  const publicChatMessages =
    interactionData?.messages.filter(
      (item) => item.channel === "public" && item.status === "visible",
    ).length ?? 0;
  const totalReactions =
    interactionData?.reactions.reduce(
      (total, item) => total + Number(item.count),
      0,
    ) ?? 0;
  const selectedCommunication = communicationItems.find(
    (item) => item.id === selectedCommunicationId,
  );
  const deliveryTotal = (status: DeliveryStat["status"]) =>
    liveDeliveryStats.find((item) => item.status === status)?.total ?? 0;

  const refreshCommunications = async () => {
    const response = await fetch(`/api/events/${event.slug}/communications`);
    if (!response.ok) return;
    const payload = (await response.json()) as {
      data?: { stats: DeliveryStat[] };
    };
    if (payload.data) setLiveDeliveryStats(payload.data.stats);
  };
  const previewText = (value: string) =>
    value
      .replaceAll("{{participant_name}}", "María")
      .replaceAll("{{event_title}}", event.title)
      .replaceAll(
        "{{event_date}}",
        formatStableDateTime(start, event.timezone),
      )
      .replaceAll(
        "{{access_link}}",
        `http://localhost:3000/room/${event.slug}?access=enlace-personal`,
      )
      .replaceAll(
        "{{manage_link}}",
        `http://localhost:3000/manage-registration/${event.slug}?access=enlace-personal`,
      )
      .replaceAll(
        "{{calendar_link}}",
        `http://localhost:3000/api/public/events/${event.slug}/calendar?access=enlace-personal`,
      );

  return (
    <>
      <div className="detail-breadcrumb"><Link href="/events">Eventos</Link><span>›</span>{event.title}</div>
      <header className="event-detail-header">
        <div className={`event-hero-date ${event.format}`}>
          <b>{new Intl.DateTimeFormat("es-CO", { day: "2-digit", timeZone: event.timezone }).format(start)}</b>
          <span>{new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: event.timezone }).format(start).replace(".", "").toUpperCase()}</span>
        </div>
        <div className="event-title-block">
          <div className="catalog-badges">
            <span className={`format-badge ${event.format}`}>{event.format === "live" ? "En vivo" : event.format === "hybrid" ? "Híbrido" : "Simulado"}</span>
            <span className={`status plain ${event.status}`}>● {statusLabels[event.status]}</span>
          </div>
          <h1>{event.title}</h1>
          <p>◷ {formatStableDateTime(start, event.timezone)} · {Math.round((end.getTime() - start.getTime()) / 60000)} min</p>
        </div>
        <div className="detail-actions">
          <label className="status-control">
            Estado
            <select
              value={event.status}
              disabled={saving || eventStatusTransitions[event.status].length === 0}
              onChange={(input) => {
                const target = input.target.value as EventData["status"];
                if (target === event.status) return;
                if (confirmableTransitions[target]) {
                  setPendingStatus(target);
                } else {
                  void patchEvent({ status: target });
                }
              }}
            >
              {[event.status, ...eventStatusTransitions[event.status]].map((value) => (
                <option value={value} key={value}>{statusLabels[value]}</option>
              ))}
            </select>
          </label>
          <button className="primary-button" disabled={saving} onClick={() => void patchEvent({ registrationOpen: !event.registrationOpen })}>
            {event.registrationOpen ? "Cerrar registro" : "Abrir registro"}
          </button>
          <button
            className="template-save-button"
            disabled={saving}
            title="Guarda formato, duración, campos, comunicaciones y marca como plantilla reutilizable"
            onClick={() => {
              const name = window.prompt(
                "Nombre de la plantilla (guarda formato, duración, campos de registro, comunicaciones y marca):",
                `Plantilla · ${event.title}`,
              );
              if (!name?.trim()) return;
              void fetch("/api/event-templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ eventSlug: event.slug, name: name.trim() }),
              })
                .then((response) => response.json())
                .then((payload: { data?: { name: string }; error?: string }) => {
                  setMessage(
                    payload.data
                      ? `Plantilla “${payload.data.name}” guardada. Estará disponible al crear eventos.`
                      : payload.error ?? "No fue posible guardar la plantilla.",
                  );
                });
            }}
          >
            Guardar como plantilla
          </button>
        </div>
      </header>

      {message && <div className="detail-message" role="status">{message}</div>}

      <nav className="detail-tabs" aria-label="Secciones del evento">
        {["Resumen", "Registro", "Comunicaciones", "Transmisión", "Interacción", "Analítica"].map((tab) => (
          <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => selectTab(tab)}>{tab}</button>
        ))}
      </nav>

      {activeTab === "Resumen" ? (
        <div className="detail-grid">
          <div className="detail-main">
            <section className="panel detail-panel">
              <div className="panel-heading">
                <div><h2>Agenda</h2><p>Sesiones que componen este evento.</p></div>
                <button
                  type="button"
                  onClick={() => {
                    setSessionError("");
                    setSessionEditor("new");
                  }}
                >
                  ＋ Añadir sesión
                </button>
              </div>
              <div className="session-list">
                {sessionItems.map((session, index) => (
                  <div className="session-row" key={session.id}>
                    <span className="session-number">{index + 1}</span>
                    <div>
                      <b>{session.title}{session.id === streamingSession?.id && <i>Principal</i>}</b>
                      <p>{formatStableTime(new Date(session.startsAt), event.timezone)} — {formatStableTime(new Date(session.endsAt), event.timezone)}</p>
                    </div>
                    <span className="session-provider">
                      {session.streamingMode === "simulated"
                        ? "Video"
                        : session.streamingMode === "zoom_only"
                          ? "Zoom"
                          : session.streamingMode === "ivs_direct"
                            ? "Amazon IVS"
                            : "Zoom + IVS"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionError("");
                        setSessionEditor(session);
                      }}
                      aria-label={`Editar ${session.title}`}
                    >
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel detail-panel">
              <div className="panel-heading"><div><h2>Preparación del evento</h2><p>Pasos esenciales antes de publicar.</p></div></div>
              <div className="readiness-list">
                <div className="ready"><span>✓</span><div><b>Información principal</b><p>Fecha, formato y capacidad definidos.</p></div><small>Completo</small></div>
                <div className={event.registrationOpen ? "ready" : ""}><span>{event.registrationOpen ? "✓" : "2"}</span><div><b>Página de registro</b><p>Configura campos, marca y mensajes.</p></div><small>{event.registrationOpen ? "Activa" : "Pendiente"}</small></div>
                <div className={streamingSession?.streamingStatus === "ready" ? "ready" : ""}><span>{streamingSession?.streamingStatus === "ready" ? "✓" : "3"}</span><div><b>Transmisión</b><p>Configura Zoom y prepara el canal de IVS.</p></div><small>{streamingSession?.streamingStatus === "ready" ? "Lista localmente" : "Pendiente"}</small></div>
              </div>
            </section>
          </div>

          <aside className="detail-side">
            <section className="panel mini-stats">
              <div><small>REGISTRADOS</small><strong>{registrationCount.toLocaleString("es-CO")}</strong><span>de {event.maxAttendees.toLocaleString("es-CO")}</span></div>
              <div><small>REGISTRO</small><strong className={event.registrationOpen ? "green-text" : ""}>{event.registrationOpen ? "Abierto" : "Cerrado"}</strong><span>Acceso público</span></div>
            </section>
            <section className="panel transmission-card">
              <div className="panel-heading"><div><h2>Transmisión</h2><p>Servicios del evento.</p></div></div>
              <div className="transmission-service"><span className="service-logo zoom">zoom</span><div><b>Zoom</b><small>{zoom?.accountLabel ?? "Sin cuenta"}</small></div><i className={zoom?.status ?? "pending"}>{zoom?.status === "connected" ? "Conectado" : "Pendiente"}</i></div>
              <div className="transmission-service"><span className="service-logo aws">aws</span><div><b>Amazon IVS</b><small>{ivs?.accountLabel ?? "Entorno local"}</small></div><i className={ivs?.status ?? "disconnected"}>{ivs?.status === "connected" ? "Conectado" : "Local"}</i></div>
              <button onClick={() => setActiveTab("Transmisión")} className="secondary-button">Configurar transmisión</button>
            </section>
            <OrganizersPanel eventSlug={event.slug} />
          </aside>
        </div>
      ) : activeTab === "Registro" ? (
        <div className="registration-section">
          <div className="registration-admin-grid">
            <section className="panel registration-admin-card">
              <span className={event.registrationOpen ? "active" : ""}>◎</span>
              <p className="eyebrow">PÁGINA PÚBLICA</p>
              <h2>{event.registrationOpen ? "El registro está abierto" : "El registro está cerrado"}</h2>
              <p>Comparte el enlace público para que los asistentes completen sus datos y queden asociados automáticamente a este evento.</p>
              <div className="public-link-box"><code>/register/{event.slug}</code><Link href={`/register/${event.slug}`} target="_blank">Abrir página ↗</Link></div>
              <button className="primary-button" disabled={saving} onClick={() => void patchEvent({ registrationOpen: !event.registrationOpen })}>{event.registrationOpen ? "Cerrar inscripciones" : "Abrir inscripciones"}</button>
              <label className="self-service-cutoff">
                Plazo de autogestión del asistente
                <select
                  value={event.selfServiceCutoffMinutes}
                  disabled={saving}
                  onChange={(input) =>
                    void patchEvent({ selfServiceCutoffMinutes: Number(input.target.value) })
                  }
                >
                  <option value={0}>Hasta el inicio del evento</option>
                  <option value={60}>Cierra 1 hora antes</option>
                  <option value={120}>Cierra 2 horas antes</option>
                  <option value={360}>Cierra 6 horas antes</option>
                  <option value={720}>Cierra 12 horas antes</option>
                  <option value={1440}>Cierra 1 día antes</option>
                  <option value={2880}>Cierra 2 días antes</option>
                  <option value={10080}>Cierra 7 días antes</option>
                </select>
                <small>Después de este plazo, el enlace personal no permite editar ni cancelar la inscripción.</small>
              </label>
              <label className="post-registration-field">
                Redirección después del registro (opcional)
                <div>
                  <input
                    type="url"
                    placeholder="https://tusitio.com/gracias"
                    maxLength={500}
                    defaultValue={event.postRegistrationUrl ?? ""}
                    disabled={saving}
                    onBlur={(input) => {
                      const value = input.target.value.trim();
                      if ((event.postRegistrationUrl ?? "") !== value) {
                        void patchEvent({ postRegistrationUrl: value || null });
                      }
                    }}
                  />
                </div>
                <small>Si la defines, la confirmación de registro ofrecerá continuar hacia esa página informativa.</small>
              </label>
            </section>
            <section className="panel registration-summary-card">
              <small>PARTICIPANTES REGISTRADOS</small>
              <strong>{registrationCount.toLocaleString("es-CO")}</strong>
              <p>Capacidad máxima: {event.maxAttendees.toLocaleString("es-CO")}</p>
              <div><span style={{ width: `${Math.min(100, (registrationCount / event.maxAttendees) * 100)}%` }} /></div>
              <Link href="/participants">Ver participantes →</Link>
            </section>
          </div>
          <section className="panel event-brand-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">APARIENCIA</p>
                <h2>Colores del evento</h2>
                <p>Sobrescriben la marca global en la página de registro, la sala y la autogestión de este evento.</p>
              </div>
              <button
                disabled={saving || (!event.brandPrimaryColor && !event.brandAccentColor && !event.brandBackgroundColor)}
                onClick={() =>
                  void patchEvent({
                    brandPrimaryColor: null,
                    brandAccentColor: null,
                    brandBackgroundColor: null,
                  })
                }
              >
                Volver a la marca global
              </button>
            </div>
            <div className="event-brand-colors">
              {([
                { key: "brandPrimaryColor", label: "Color principal", fallback: "#24194F" },
                { key: "brandAccentColor", label: "Color de acento", fallback: "#6946E8" },
                { key: "brandBackgroundColor", label: "Fondo de páginas públicas", fallback: "#FBFAFC" },
              ] as const).map((item) => (
                <label key={item.key}>
                  <input
                    type="color"
                    value={event[item.key] ?? item.fallback}
                    disabled={saving}
                    onChange={(input) => void patchEvent({ [item.key]: input.target.value })}
                  />
                  <span>
                    <b>{item.label}</b>
                    <small>{event[item.key] ?? "Marca global"}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <RegistrationFieldsManager eventSlug={event.slug} />
        </div>
      ) : activeTab === "Comunicaciones" ? (
        <div className="communications-section">
          <div className="communication-stats">
            <div><small>EN COLA</small><strong>{deliveryTotal("queued")}</strong><span>Listos para enviar</span></div>
            <div><small>PROGRAMADOS</small><strong>{deliveryTotal("scheduled")}</strong><span>Según la fecha del evento</span></div>
            <div><small>ENVIADOS</small><strong>{deliveryTotal("sent")}</strong><span>Al buzón local o al proveedor</span></div>
            <div><small>CON ERROR</small><strong>{deliveryTotal("failed")}</strong><span>Reintentos agotados</span></div>
            <button
              className="worker-run-button"
              disabled={saving}
              onClick={() => {
                void fetch(`/api/events/${event.slug}/communications/process`, { method: "POST" })
                  .then((response) => response.json())
                  .then((payload: { data?: { sent: number; retried: number; failed: number; provider: string }; error?: string }) => {
                    if (payload.data) {
                      setMessage(
                        `Worker ejecutado (proveedor ${payload.data.provider === "local" ? "buzón local" : payload.data.provider}): ${payload.data.sent} enviadas, ${payload.data.retried} reintentos, ${payload.data.failed} fallidas.`,
                      );
                      void refreshCommunications();
                    } else {
                      setMessage(payload.error ?? "No fue posible procesar la cola.");
                    }
                  });
              }}
            >
              Procesar cola ahora ⟳
            </button>
          </div>
          <div className="communications-grid">
            <section className="panel communication-list-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">AUTOMATIZACIONES</p>
                  <h2>Secuencia del participante</h2>
                  <p>Activa y prepara los mensajes asociados al registro.</p>
                </div>
              </div>
              <div className="communication-list">
                {communicationItems.map((item) => {
                  const label = communicationLabels[item.type];
                  return (
                    <article
                      className={selectedCommunicationId === item.id ? "selected" : ""}
                      key={item.id}
                      onClick={() => setSelectedCommunicationId(item.id)}
                    >
                      <span className="communication-icon">{label.icon}</span>
                      <div>
                        <b>{label.title}</b>
                        <p>{label.timing}</p>
                        <small>{item.enabled ? "Automatización activa" : "Automatización pausada"}</small>
                      </div>
                      <button
                        type="button"
                        className={`communication-toggle ${item.enabled ? "active" : ""}`}
                        role="switch"
                        aria-checked={item.enabled}
                        aria-label={`${item.enabled ? "Pausar" : "Activar"} ${label.title}`}
                        disabled={communicationSaving}
                        onClick={(click) => {
                          click.stopPropagation();
                          void patchCommunication(item.id, { enabled: !item.enabled });
                        }}
                      >
                        <span />
                      </button>
                    </article>
                  );
                })}
              </div>
              <div className="local-queue-note">
                <span>⌁</span>
                <p><b>Modo local</b> Las entregas quedan registradas en la base de datos. Ningún correo saldrá hasta conectar Amazon SES u otro proveedor.</p>
              </div>
            </section>

            <aside className="panel communication-editor">
              {selectedCommunication ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">EDITOR Y VISTA PREVIA</p>
                      <h2>{communicationLabels[selectedCommunication.type].title}</h2>
                    </div>
                    <span className={selectedCommunication.enabled ? "active" : ""}>
                      {selectedCommunication.enabled ? "Activo" : "Pausado"}
                    </span>
                  </div>
                  <label>
                    Asunto
                    <input
                      maxLength={180}
                      value={selectedCommunication.subject}
                      onChange={(input) =>
                        setCommunicationItems((items) =>
                          items.map((item) =>
                            item.id === selectedCommunication.id
                              ? { ...item, subject: input.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Mensaje
                    <textarea
                      maxLength={10000}
                      rows={9}
                      value={selectedCommunication.body}
                      onChange={(input) =>
                        setCommunicationItems((items) =>
                          items.map((item) =>
                            item.id === selectedCommunication.id
                              ? { ...item, body: input.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="template-tags">
                    <span>{"{{participant_name}}"}</span>
                    <span>{"{{event_title}}"}</span>
                    <span>{"{{event_date}}"}</span>
                    <span>{"{{access_link}}"}</span>
                    <span>{"{{manage_link}}"}</span>
                    <span>{"{{calendar_link}}"}</span>
                  </div>
                  <button
                    className="primary-button"
                    disabled={
                      communicationSaving ||
                      !selectedCommunication.subject.trim() ||
                      !selectedCommunication.body.trim()
                    }
                    onClick={() =>
                      void patchCommunication(selectedCommunication.id, {
                        subject: selectedCommunication.subject,
                        body: selectedCommunication.body,
                      })
                    }
                  >
                    {communicationSaving ? "Guardando…" : "Guardar plantilla"}
                  </button>
                  <div className="email-preview">
                    <small>VISTA PREVIA PARA EL PARTICIPANTE</small>
                    <b>{previewText(selectedCommunication.subject)}</b>
                    <p>{previewText(selectedCommunication.body)}</p>
                  </div>
                </>
              ) : (
                <div className="tab-placeholder">
                  <span>✉</span>
                  <h2>Sin plantillas</h2>
                  <p>Precarga la secuencia estándar de la plataforma y edítala aquí.</p>
                  <button
                    className="primary-button"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      void (async () => {
                        const response = await fetch(
                          `/api/events/${event.slug}/communications`,
                          { method: "POST" },
                        );
                        if (response.ok) window.location.reload();
                      })();
                    }}
                  >
                    Precargar plantillas del sistema
                  </button>
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : activeTab === "Interacción" ? (
        interactionLoading || !interactionData ? (
          <section className="panel tab-placeholder">
            <span>⌁</span>
            <h2>{interactionLoading ? "Cargando interacción…" : "Interacción no disponible"}</h2>
            <p>Preparando chat, preguntas, encuestas y recursos del evento.</p>
          </section>
        ) : (
          <div className="interaction-section">
            <div className="interaction-stats">
              <article><span>?</span><div><strong>{pendingQuestions}</strong><p>preguntas pendientes</p></div></article>
              <article><span>◉</span><div><strong>{openPolls}</strong><p>encuestas abiertas</p></div></article>
              <article><span>✓</span><div><strong>{totalPollVotes}</strong><p>respuestas registradas</p></div></article>
              <article><span>☵</span><div><strong>{publicChatMessages}</strong><p>mensajes públicos</p></div></article>
              <article><span>👏</span><div><strong>{totalReactions}</strong><p>reacciones rápidas</p></div></article>
            </div>

            <div className="interaction-grid">
              <section className="panel question-moderation">
                <div className="panel-heading">
                  <div><p className="eyebrow">PREGUNTAS Y RESPUESTAS</p><h2>Cola de moderación</h2><p>Prioriza y clasifica las preguntas de los participantes.</p></div>
                  <span>{interactionData.questions.length} preguntas</span>
                </div>
                <div className="question-list">
                  {interactionData.questions.length ? (
                    interactionData.questions.map((question) => (
                      <article className={question.status} key={question.id}>
                        <div className="question-votes"><b>▲</b><span>{question.upvotes}</span></div>
                        <div className="question-content">
                          <div className="question-author">
                            <span>{question.authorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                            <p><b>{question.authorName}</b><small>{formatStableDateTime(new Date(question.createdAt), event.timezone, "short")}</small></p>
                            <i>{question.status === "pending" ? "Pendiente" : question.status === "answered" ? "Respondida" : "Descartada"}</i>
                          </div>
                          <p>{question.question}</p>
                          <div className="question-actions">
                            {question.status !== "answered" && (
                              <button disabled={interactionSaving === question.id} onClick={() => void updateQuestionStatus(question.id, "answered")}>✓ Marcar respondida</button>
                            )}
                            {question.status !== "dismissed" && (
                              <button disabled={interactionSaving === question.id} onClick={() => void updateQuestionStatus(question.id, "dismissed")}>Descartar</button>
                            )}
                            {question.status !== "pending" && (
                              <button disabled={interactionSaving === question.id} onClick={() => void updateQuestionStatus(question.id, "pending")}>Reabrir</button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="interaction-empty">Aún no hay preguntas para moderar.</div>
                  )}
                </div>
              </section>

              <div className="poll-column">
                <section className="panel poll-management">
                  <div className="panel-heading">
                    <div><p className="eyebrow">ENCUESTAS</p><h2>Participación en vivo</h2><p>Abre una pregunta durante la sesión y revisa sus resultados.</p></div>
                  </div>
                  <div className="poll-list">
                    {interactionData.polls.length ? (
                      interactionData.polls.map((poll) => {
                        const pollTotal = poll.options.reduce(
                          (total, option) => total + option.votes,
                          0,
                        );
                        return (
                          <article key={poll.id}>
                            <header>
                              <span className={poll.status}>{poll.status === "draft" ? "Borrador" : poll.status === "open" ? "Abierta" : "Cerrada"}</span>
                              <small>{pollTotal} respuestas</small>
                            </header>
                            <h3>{poll.question}</h3>
                            <div className="poll-options">
                              {poll.options.map((option) => {
                                const percentage = pollTotal
                                  ? Math.round((option.votes / pollTotal) * 100)
                                  : 0;
                                return (
                                  <div key={option.id}>
                                    <p><span>{option.label}</span><b>{percentage}%</b></p>
                                    <div><span style={{ width: `${percentage}%` }} /></div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="poll-actions">
                              <small>{poll.anonymous ? "Respuestas anónimas" : "Respuestas identificadas"}</small>
                              <button
                                disabled={interactionSaving === poll.id}
                                onClick={() =>
                                  void updatePollStatus(
                                    poll.id,
                                    poll.status === "open" ? "close" : "open",
                                  )
                                }
                              >
                                {poll.status === "open" ? "Cerrar encuesta" : "Abrir encuesta"}
                              </button>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="interaction-empty">Aún no hay encuestas creadas.</div>
                    )}
                  </div>
                </section>

                <section className="panel poll-creator">
                  <div className="panel-heading">
                    <div><p className="eyebrow">NUEVA ENCUESTA</p><h2>Preparar una pregunta</h2><p>Se guardará como borrador hasta que decidas abrirla.</p></div>
                  </div>
                  <div className="poll-creator-form">
                    <label>
                      Pregunta
                      <input
                        maxLength={280}
                        placeholder="¿Qué quieres preguntar a la audiencia?"
                        value={newPollQuestion}
                        onChange={(input) => setNewPollQuestion(input.target.value)}
                      />
                    </label>
                    <div className="poll-option-inputs">
                      {newPollOptions.map((option, index) => (
                        <label key={index}>
                          Opción {index + 1}
                          <input
                            maxLength={120}
                            placeholder={`Respuesta ${index + 1}`}
                            value={option}
                            onChange={(input) =>
                              setNewPollOptions((current) =>
                                current.map((currentOption, optionIndex) =>
                                  optionIndex === index ? input.target.value : currentOption,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      className="primary-button"
                      disabled={interactionSaving === "new-poll"}
                      onClick={() => void createPoll()}
                    >
                      {interactionSaving === "new-poll" ? "Creando…" : "Crear encuesta"}
                    </button>
                  </div>
                </section>
              </div>
            </div>

            <div className="live-operations-grid">
              <section className="panel live-chat-moderation">
                <div className="panel-heading">
                  <div><p className="eyebrow">CHAT PÚBLICO</p><h2>Conversación y moderación</h2><p>Publica anuncios, retira contenido y gestiona el acceso de cada participante.</p></div>
                  <span>{publicChatMessages} visibles</span>
                </div>
                <div className="staff-message-form">
                  <label htmlFor="staff-public-message">Anuncio del equipo</label>
                  <div>
                    <input
                      id="staff-public-message"
                      maxLength={500}
                      placeholder="Escribe un mensaje para toda la audiencia…"
                      value={newPublicMessage}
                      onChange={(input) => setNewPublicMessage(input.target.value)}
                    />
                    <button
                      disabled={
                        interactionSaving === "new-public-message" ||
                        !newPublicMessage.trim()
                      }
                      onClick={() => void sendStaffMessage("public")}
                    >
                      Publicar
                    </button>
                  </div>
                </div>
                <div className="moderation-message-list">
                  {interactionData.messages.filter((item) => item.channel === "public").length ? (
                    interactionData.messages
                      .filter((item) => item.channel === "public")
                      .map((item) => {
                        const participantModeration =
                          interactionData.moderations.find(
                            (moderation) =>
                              moderation.registrationId === item.registrationId,
                          );
                        const currentlyMuted =
                          participantModeration?.mutedUntil &&
                          new Date(participantModeration.mutedUntil).getTime() >
                            new Date(interactionData.serverTime).getTime();
                        return (
                          <article className={item.status} key={item.id}>
                            <header>
                              <span>{item.authorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                              <p><b>{item.authorName}</b><small>{item.authorEmail || "Equipo organizador"} · {formatStableDateTime(new Date(item.createdAt), event.timezone, "short")}</small></p>
                              <i>{item.status === "removed" ? "Retirado" : participantModeration?.blocked ? "Bloqueado" : currentlyMuted ? "Silenciado" : "Visible"}</i>
                            </header>
                            <p>{item.status === "removed" ? "Mensaje retirado por moderación." : item.message}</p>
                            <div>
                              {item.status === "visible" && (
                                <button
                                  disabled={interactionSaving === `remove-${item.id}`}
                                  onClick={() =>
                                    void patchLiveInteraction(
                                      `remove-${item.id}`,
                                      { entity: "chat", id: item.id, action: "remove" },
                                      "Mensaje retirado del chat.",
                                    )
                                  }
                                >
                                  Retirar mensaje
                                </button>
                              )}
                              {item.registrationId && (
                                <>
                                  <button
                                    disabled={interactionSaving === `mute-${item.registrationId}`}
                                    onClick={() =>
                                      void patchLiveInteraction(
                                        `mute-${item.registrationId}`,
                                        {
                                          entity: "moderation",
                                          registrationId: item.registrationId!,
                                          action: currentlyMuted ? "unmute" : "mute",
                                          reason: currentlyMuted ? "" : "Moderación del chat en vivo",
                                        },
                                        currentlyMuted ? "Silencio retirado." : "Participante silenciado por 15 minutos.",
                                      )
                                    }
                                  >
                                    {currentlyMuted ? "Quitar silencio" : "Silenciar 15 min"}
                                  </button>
                                  <button
                                    className="danger"
                                    disabled={interactionSaving === `block-${item.registrationId}`}
                                    onClick={() =>
                                      void patchLiveInteraction(
                                        `block-${item.registrationId}`,
                                        {
                                          entity: "moderation",
                                          registrationId: item.registrationId!,
                                          action: participantModeration?.blocked ? "unblock" : "block",
                                          reason: participantModeration?.blocked ? "" : "Bloqueo manual del moderador",
                                        },
                                        participantModeration?.blocked ? "Participante desbloqueado." : "Participante bloqueado.",
                                      )
                                    }
                                  >
                                    {participantModeration?.blocked ? "Desbloquear" : "Bloquear"}
                                  </button>
                                </>
                              )}
                            </div>
                          </article>
                        );
                      })
                  ) : (
                    <div className="interaction-empty">Aún no hay mensajes públicos.</div>
                  )}
                </div>
              </section>

              <div className="live-tools-column">
                <section className="panel resource-management">
                  <div className="panel-heading">
                    <div><p className="eyebrow">RECURSOS</p><h2>Enlaces y archivos</h2><p>Comparte destinos HTTP/HTTPS; en producción podrán ser enlaces temporales de S3.</p></div>
                  </div>
                  <div className="resource-creator-form">
                    <label>
                      Título
                      <input
                        maxLength={160}
                        placeholder="Guía, presentación o formulario"
                        value={newResourceTitle}
                        onChange={(input) => setNewResourceTitle(input.target.value)}
                      />
                    </label>
                    <label>
                      URL segura
                      <input
                        type="url"
                        placeholder="https://…"
                        value={newResourceUrl}
                        onChange={(input) => setNewResourceUrl(input.target.value)}
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        value={newResourceKind}
                        onChange={(input) =>
                          setNewResourceKind(
                            input.target.value as InteractionResource["kind"],
                          )
                        }
                      >
                        <option value="link">Enlace externo</option>
                        <option value="file">Archivo</option>
                      </select>
                    </label>
                    <button
                      className="primary-button"
                      disabled={
                        interactionSaving === "new-resource" ||
                        !newResourceTitle.trim() ||
                        !newResourceUrl.trim()
                      }
                      onClick={() => void createResource()}
                    >
                      {interactionSaving === "new-resource" ? "Agregando…" : "Agregar recurso"}
                    </button>
                  </div>
                  <div className="managed-resource-list">
                    {interactionData.resources.map((resource) => (
                      <article className={resource.visible ? "" : "hidden"} key={resource.id}>
                        <span>{resource.kind === "file" ? "↓" : "↗"}</span>
                        <p><b>{resource.title}</b><a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.url}</a></p>
                        <button
                          disabled={interactionSaving === `resource-${resource.id}`}
                          onClick={() =>
                            void patchLiveInteraction(
                              `resource-${resource.id}`,
                              {
                                entity: "resource",
                                id: resource.id,
                                action: resource.visible ? "hide" : "show",
                              },
                              resource.visible ? "Recurso ocultado." : "Recurso publicado.",
                            )
                          }
                        >
                          {resource.visible ? "Ocultar" : "Publicar"}
                        </button>
                      </article>
                    ))}
                    {!interactionData.resources.length && (
                      <div className="interaction-empty">Aún no hay recursos compartidos.</div>
                    )}
                  </div>
                </section>

                <section className="panel backstage-management">
                  <div className="panel-heading">
                    <div><p className="eyebrow">CANAL PRIVADO</p><h2>Backstage de producción</h2><p>Solo administradores y organizadores pueden ver esta conversación.</p></div>
                    <span>Privado</span>
                  </div>
                  <div className="backstage-message-list" role="log" aria-live="polite">
                    {interactionData.messages
                      .filter(
                        (item) =>
                          item.channel === "backstage" &&
                          item.status === "visible",
                      )
                      .slice(0, 50)
                      .reverse()
                      .map((item) => (
                        <article key={item.id}>
                          <header><b>{item.authorName}</b><small>{formatStableTime(new Date(item.createdAt), event.timezone)}</small></header>
                          <p>{item.message}</p>
                        </article>
                      ))}
                    {!interactionData.messages.some(
                      (item) =>
                        item.channel === "backstage" &&
                        item.status === "visible",
                    ) && (
                      <div className="interaction-empty">El canal privado está listo para producción.</div>
                    )}
                  </div>
                  <div className="staff-message-form backstage">
                    <label htmlFor="staff-backstage-message">Mensaje privado</label>
                    <div>
                      <input
                        id="staff-backstage-message"
                        maxLength={500}
                        placeholder="Ej. Cámara 2 lista; pasamos a preguntas…"
                        value={newBackstageMessage}
                        onChange={(input) => setNewBackstageMessage(input.target.value)}
                        onKeyDown={(keyboardEvent) => {
                          if (keyboardEvent.key === "Enter" && newBackstageMessage.trim()) {
                            keyboardEvent.preventDefault();
                            void sendStaffMessage("backstage");
                          }
                        }}
                      />
                      <button
                        disabled={
                          interactionSaving === "new-backstage-message" ||
                          !newBackstageMessage.trim()
                        }
                        onClick={() => void sendStaffMessage("backstage")}
                      >
                        Enviar
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="local-interaction-note">
              <span>⌁</span>
              <p><b>Consola local sincronizada</b> La sala y esta vista consultan cambios cada 2 segundos. La infraestructura WebSocket/SSE y escalamiento horizontal se activarán al desplegar.</p>
              <Link href={`/room/${event.slug}`} target="_blank">Abrir vista previa ↗</Link>
            </div>
          </div>
        )
      ) : activeTab === "Transmisión" ? (
        streamingSession ? (
          <div className="streaming-section">
            {event.format === "simulated" && (
              <RecordedVideoPanel
                eventSlug={event.slug}
                postEventRedirectUrl={event.postEventRedirectUrl}
                saving={saving}
                onRedirectChange={(value) =>
                  void patchEvent({ postEventRedirectUrl: value })
                }
              />
            )}
            {(event.format === "simulated" || event.format === "hybrid") && (
              <SimulatedContentPanel
                eventSlug={event.slug}
                isHybrid={event.format === "hybrid"}
              />
            )}
            <section className="panel streaming-overview">
              <div>
                <p className="eyebrow">ESTADO TÉCNICO</p>
                <h2>{streamingStatusLabels[streamingSession.streamingStatus]}</h2>
                <p>{streamingProgress}% de la configuración local preparada.</p>
              </div>
              <div className="streaming-progress">
                <span style={{ width: `${streamingProgress}%` }} />
              </div>
              <div className="streaming-overview-actions">
                <button
                  className="secondary-action"
                  disabled={streamingSaving}
                  onClick={() => void saveStreamingConfiguration("run_check")}
                >
                  {streamingSaving ? "Verificando…" : "Ejecutar revisión técnica"}
                </button>
                <Link className="primary-button link-button" href={`/events/${event.slug}/studio`}>
                  Abrir sala técnica
                </Link>
              </div>
            </section>

            <div className="streaming-pipeline" aria-label="Flujo de transmisión">
              <article className={streamingSession.streamingMode === "ivs_direct" ? "muted" : ""}>
                <span className="service-logo zoom">zoom</span>
                <div><small>FUENTE</small><b>{streamingSession.streamingMode === "ivs_direct" ? "Entrada directa" : "Zoom Meeting"}</b><p>{streamingCredentials.zoomCredentialsConfigured ? "Credenciales disponibles" : "Credenciales pendientes"}</p></div>
              </article>
              <i>→</i>
              <article className={streamingSession.streamingMode === "zoom_only" ? "muted" : ""}>
                <span className="service-logo aws">aws</span>
                <div><small>DISTRIBUCIÓN</small><b>{streamingSession.streamingMode === "zoom_only" ? "Directo desde Zoom" : "Amazon IVS"}</b><p>{streamingCredentials.awsCredentialsConfigured ? `Región ${streamingCredentials.awsRegion}` : "Credenciales pendientes"}</p></div>
              </article>
              <i>→</i>
              <article>
                <span className="pipeline-audience">♙</span>
                <div><small>AUDIENCIA</small><b>Participantes</b><p>{registrationCount.toLocaleString("es-CO")} registrados</p></div>
              </article>
            </div>

            <div className="streaming-config-grid">
              <section className="panel streaming-form-card">
                <div className="panel-heading">
                  <div><p className="eyebrow">CONFIGURACIÓN</p><h2>{streamingSession.title}</h2><p>Define la fuente y la distribución de esta sesión.</p></div>
                </div>
                <div className="streaming-form">
                  <label>
                    Flujo de transmisión
                    <select
                      value={streamingSession.streamingMode}
                      onChange={(input) =>
                        setStreamingSession({
                          ...streamingSession,
                          streamingMode: input.target.value as StreamingMode,
                        })
                      }
                    >
                      <option value="zoom_to_ivs">Zoom → Amazon IVS</option>
                      <option value="zoom_only">Solo Zoom</option>
                      <option value="ivs_direct">Entrada directa a Amazon IVS</option>
                      <option value="simulated">Contenido simulado</option>
                    </select>
                  </label>

                  {(streamingSession.streamingMode === "zoom_to_ivs" ||
                    streamingSession.streamingMode === "zoom_only") && (
                    <fieldset>
                      <legend><span className="service-logo zoom">zoom</span><div><b>Zoom</b><small>Fuente del presentador</small></div></legend>
                      <div className="streaming-field-row">
                        <label>
                          ID de la reunión
                          <input
                            maxLength={80}
                            placeholder="123 456 7890"
                            value={streamingSession.zoomMeetingId ?? ""}
                            onChange={(input) =>
                              setStreamingSession({
                                ...streamingSession,
                                zoomMeetingId: input.target.value || null,
                              })
                            }
                          />
                        </label>
                        <label>
                          Enlace de ingreso
                          <input
                            type="url"
                            maxLength={500}
                            placeholder="https://zoom.us/j/..."
                            value={streamingSession.zoomJoinUrl ?? ""}
                            onChange={(input) =>
                              setStreamingSession({
                                ...streamingSession,
                                zoomJoinUrl: input.target.value || null,
                              })
                            }
                          />
                        </label>
                      </div>
                    </fieldset>
                  )}

                  {(streamingSession.streamingMode === "zoom_to_ivs" ||
                    streamingSession.streamingMode === "ivs_direct") && (
                    <fieldset>
                      <legend><span className="service-logo aws">aws</span><div><b>Amazon IVS</b><small>Distribución de baja latencia</small></div></legend>
                      <label>
                        ARN del canal
                        <input
                          maxLength={500}
                          placeholder={`arn:aws:ivs:${streamingCredentials.awsRegion}:...:channel/...`}
                          value={streamingSession.ivsChannelArn ?? ""}
                          onChange={(input) =>
                            setStreamingSession({
                              ...streamingSession,
                              ivsChannelArn: input.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label>
                        URL de reproducción
                        <input
                          type="url"
                          maxLength={1000}
                          placeholder="https://....playback.live-video.net/api/video/v1/..."
                          value={streamingSession.playbackUrl ?? ""}
                          onChange={(input) =>
                            setStreamingSession({
                              ...streamingSession,
                              playbackUrl: input.target.value || null,
                            })
                          }
                        />
                      </label>
                    </fieldset>
                  )}

                  <div className="streaming-options">
                    <label>
                      Latencia
                      <select
                        value={streamingSession.latencyMode}
                        onChange={(input) =>
                          setStreamingSession({
                            ...streamingSession,
                            latencyMode: input.target.value as "low" | "standard",
                          })
                        }
                      >
                        <option value="low">Baja latencia</option>
                        <option value="standard">Estándar</option>
                      </select>
                    </label>
                    <label className="recording-option">
                      <input
                        type="checkbox"
                        checked={streamingSession.recordingEnabled}
                        onChange={(input) =>
                          setStreamingSession({
                            ...streamingSession,
                            recordingEnabled: input.target.checked,
                          })
                        }
                      />
                      <span><b>Grabar la sesión</b><small>Preparar el archivo para publicación posterior.</small></span>
                    </label>
                  </div>
                  <div className="streaming-save-row">
                    <p>Las claves privadas se leerán desde el servidor y nunca se guardarán en este formulario.</p>
                    <button
                      className="primary-button"
                      disabled={streamingSaving}
                      onClick={() => void saveStreamingConfiguration("save")}
                    >
                      {streamingSaving ? "Guardando…" : "Guardar configuración"}
                    </button>
                  </div>
                </div>
              </section>

              <aside className="panel technical-checks">
                <div className="panel-heading">
                  <div><p className="eyebrow">LISTA TÉCNICA</p><h2>Preparación local</h2><p>Validaciones antes de conectar proveedores.</p></div>
                </div>
                <div className="technical-check-list">
                  {technicalChecks.map((check) => (
                    <div className={check.status} key={check.id}>
                      <span>{check.status === "pass" ? "✓" : check.status === "warning" ? "!" : "×"}</span>
                      <p><b>{check.label}</b><small>{check.detail}</small></p>
                    </div>
                  ))}
                </div>
                {streamingSession.technicalCheckAt && (
                  <p className="last-technical-check">
                    Última revisión: {formatStableDateTime(
                      new Date(streamingSession.technicalCheckAt),
                      event.timezone,
                      "short",
                    )}
                  </p>
                )}
              </aside>
            </div>
          </div>
        ) : (
          <section className="panel tab-placeholder">
            <span>◉</span>
            <h2>Sin sesión principal</h2>
            <p>Crea una sesión para configurar Zoom y Amazon IVS.</p>
          </section>
        )
      ) : activeTab === "Analítica" ? (
        <>
          <EventAnalyticsPanel
            slug={event.slug}
            maxAttendees={event.maxAttendees}
          />
          <FeedbackAdminPanel
            eventSlug={event.slug}
            feedbackEnabled={event.feedbackEnabled}
            feedbackQuestion={event.feedbackQuestion}
            saving={saving}
            onConfigChange={(changes) => void patchEvent(changes)}
          />
        </>
      ) : (
        <section className="panel tab-placeholder">
          <span>⌁</span>
          <h2>{activeTab}</h2>
          <p>Esta sección ya forma parte de la navegación y se conectará en el siguiente ciclo funcional.</p>
        </section>
      )}

      {sessionEditor && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!sessionSaving) setSessionEditor(null);
          }}
        >
          <section
            className="modal session-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-editor-title"
            onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
          >
            <button
              className="modal-close"
              disabled={sessionSaving}
              onClick={() => setSessionEditor(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <span className="modal-icon">◷</span>
            <p className="eyebrow">
              {sessionEditor === "new" ? "NUEVA SESIÓN" : "EDITAR SESIÓN"}
            </p>
            <h2 id="session-editor-title">
              {sessionEditor === "new"
                ? "Añadir a la agenda"
                : sessionEditor.title}
            </h2>
            <p>
              El horario debe quedar dentro del inicio y final del evento.
            </p>
            <form
              className="event-form session-form"
              key={
                sessionEditor === "new"
                  ? "new-session"
                  : sessionEditor.id
              }
              onSubmit={saveSession}
            >
              <label>
                Nombre de la sesión
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={
                    sessionEditor === "new" ? "" : sessionEditor.title
                  }
                  placeholder="Ej. Conversación con expertos"
                />
              </label>
              <div className="form-row">
                <label>
                  Inicio
                  <input
                    name="startsAt"
                    type="datetime-local"
                    required
                    min={toLocalDateTimeInput(event.startsAt)}
                    max={toLocalDateTimeInput(event.endsAt)}
                    defaultValue={toLocalDateTimeInput(
                      sessionEditor === "new"
                        ? event.startsAt
                        : sessionEditor.startsAt,
                    )}
                  />
                </label>
                <label>
                  Finalización
                  <input
                    name="endsAt"
                    type="datetime-local"
                    required
                    min={toLocalDateTimeInput(event.startsAt)}
                    max={toLocalDateTimeInput(event.endsAt)}
                    defaultValue={toLocalDateTimeInput(
                      sessionEditor === "new"
                        ? event.endsAt
                        : sessionEditor.endsAt,
                    )}
                  />
                </label>
              </div>
              <p className="session-timezone-note">
                Zona horaria del evento: {event.timezone}. Los controles usan
                la hora de este dispositivo.
              </p>
              {sessionError && (
                <p className="form-error" role="alert">
                  {sessionError}
                </p>
              )}
              <div className="session-form-actions">
                {sessionEditor !== "new" && (
                  <button
                    type="button"
                    className="session-delete-button"
                    disabled={sessionSaving || sessionItems.length <= 1}
                    title={
                      sessionItems.length <= 1
                        ? "El evento debe conservar al menos una sesión."
                        : "Eliminar sesión"
                    }
                    onClick={() => {
                      setSessionError("");
                      setSessionToDelete(sessionEditor);
                      setSessionEditor(null);
                    }}
                  >
                    Eliminar sesión
                  </button>
                )}
                <span />
                <button
                  type="button"
                  className="session-cancel-button"
                  disabled={sessionSaving}
                  onClick={() => setSessionEditor(null)}
                >
                  Cancelar
                </button>
                <button className="primary-button" disabled={sessionSaving}>
                  {sessionSaving
                    ? "Guardando…"
                    : sessionEditor === "new"
                      ? "Añadir sesión"
                      : "Guardar cambios"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {sessionToDelete && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!sessionSaving) setSessionToDelete(null);
          }}
        >
          <section
            className="modal session-delete-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-delete-title"
            onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
          >
            <button
              className="modal-close"
              disabled={sessionSaving}
              onClick={() => setSessionToDelete(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <span className="modal-icon danger">×</span>
            <p className="eyebrow">ELIMINAR SESIÓN</p>
            <h2 id="session-delete-title">¿Eliminar “{sessionToDelete.title}”?</h2>
            <p>
              También se quitará su configuración local de Zoom y Amazon IVS.
              Esta acción no afecta las demás sesiones.
            </p>
            {sessionError && (
              <p className="form-error" role="alert">
                {sessionError}
              </p>
            )}
            <div className="session-delete-actions">
              <button
                className="session-cancel-button"
                disabled={sessionSaving}
                onClick={() => setSessionToDelete(null)}
              >
                Conservar sesión
              </button>
              <button
                className="session-confirm-delete"
                disabled={sessionSaving}
                onClick={() => void deleteSession()}
              >
                {sessionSaving ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingStatus && confirmableTransitions[pendingStatus] && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setPendingStatus(null)}>
          <section
            className="modal session-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-confirm-title"
            onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
          >
            <button className="modal-close" disabled={saving} onClick={() => setPendingStatus(null)} aria-label="Cerrar">×</button>
            <div className={`modal-icon ${pendingStatus === "cancelled" ? "danger" : ""}`}>
              {pendingStatus === "cancelled" ? "!" : "→"}
            </div>
            <h2 id="status-confirm-title">{confirmableTransitions[pendingStatus].title}</h2>
            <p>{confirmableTransitions[pendingStatus].description}</p>
            <div className="session-delete-actions">
              <button className="session-cancel-button" disabled={saving} onClick={() => setPendingStatus(null)}>
                Volver
              </button>
              <button
                className={pendingStatus === "cancelled" ? "session-confirm-delete" : "primary-button"}
                disabled={saving}
                onClick={() => {
                  void patchEvent({ status: pendingStatus }).then(() => setPendingStatus(null));
                }}
              >
                {saving ? "Aplicando…" : `Sí, ${statusLabels[pendingStatus].toLowerCase()}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
