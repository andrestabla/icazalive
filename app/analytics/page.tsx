import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import Link from "next/link";
import { AdminIcon } from "@/app/components/admin-icon";
import { getDb } from "@/db";
import { eventOrganizers, events, registrations, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { platformLocalToDate } from "@/lib/timezone";
import AnalyticsFilters from "./analytics-filters";
import { getEventAnalytics } from "@/lib/event-analytics";
import AnalyticsCharts from "./analytics-charts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analítica — Icaza Jammoul Live",
};

const statusLabels = {
  draft: "Borrador",
  registration_open: "Registro abierto",
  preparing: "En preparación",
  live: "En vivo",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

function formatEventDate(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(value);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Alcance: el organizador solo ve sus eventos; el administrador ve todo y
  // puede filtrar por organizador, evento y rango de fechas.
  const viewer = await getCurrentUser();
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim().slice(0, 64) : "");
  const isAdmin = viewer?.role === "administrator";
  const filter = {
    organizer: isAdmin ? pick("organizer") : "",
    event: pick("event"),
    from: /^\d{4}-\d{2}-\d{2}$/.test(pick("from")) ? pick("from") : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(pick("to")) ? pick("to") : "",
  };
  const scopeUserId = isAdmin ? filter.organizer : viewer?.id ?? "";
  const scopeDb = getDb();
  const conditions = [];
  if (scopeUserId) {
    const managed = scopeDb.select({ id: eventOrganizers.eventId }).from(eventOrganizers).where(eq(eventOrganizers.userId, scopeUserId));
    conditions.push(or(inArray(events.id, managed), eq(events.createdBy, scopeUserId)));
  }
  if (filter.event) conditions.push(eq(events.id, filter.event));
  if (filter.from) conditions.push(gte(events.startsAt, platformLocalToDate(`${filter.from}T00:00`)));
  if (filter.to) conditions.push(lte(events.startsAt, platformLocalToDate(`${filter.to}T23:59`)));
  const scope = conditions.length ? and(...conditions) : undefined;
  const [organizers, allEvents] = isAdmin
    ? await Promise.all([
        scopeDb.select({ id: users.id, name: users.name }).from(users).where(and(ne(users.role, "participant"), eq(users.active, true))).orderBy(asc(users.name)),
        scopeDb.select({ id: events.id, title: events.title }).from(events).orderBy(desc(events.startsAt)),
      ])
    : [[], []];

  const eventRecords = await getDb()
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      status: events.status,
      format: events.format,
      startsAt: events.startsAt,
      timezone: events.timezone,
    })
    .from(events)
    .where(scope)
    .orderBy(desc(events.startsAt));
  const scopedEventIds = eventRecords.map((event) => event.id);
  const registrationScope = scopedEventIds.length ? inArray(registrations.eventId, scopedEventIds) : sql`false`;

  const eventMetrics = await Promise.all(
    eventRecords.map(async (event) => ({
      event,
      analytics: await getEventAnalytics(event.id),
    })),
  );

  const db = getDb();
  const [dailyRegistrations, statusDistribution] = await Promise.all([
    db
      .select({
        eventId: registrations.eventId,
        day: sql<string>`to_char(${registrations.registeredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(registrationScope)
      .groupBy(
        registrations.eventId,
        sql`to_char(${registrations.registeredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      ),
    db
      .select({
        eventId: registrations.eventId,
        status: registrations.status,
        total: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(registrationScope)
      .groupBy(registrations.eventId, registrations.status),
  ]);

  const totals = eventMetrics.reduce(
    (summary, item) => {
      summary.registrations += item.analytics.registration.total;
      summary.roomVisitors += item.analytics.registration.roomVisitors;
      summary.engaged += item.analytics.interaction.uniqueParticipants;
      summary.questions += item.analytics.interaction.questions;
      summary.votes += item.analytics.interaction.votes;
      summary.readyMessages +=
        item.analytics.communications.queued +
        item.analytics.communications.scheduled;
      summary.readyStreams +=
        item.analytics.streaming.ready + item.analytics.streaming.live;
      summary.sessions += item.analytics.streaming.sessions;
      return summary;
    },
    {
      registrations: 0,
      roomVisitors: 0,
      engaged: 0,
      questions: 0,
      votes: 0,
      readyMessages: 0,
      readyStreams: 0,
      sessions: 0,
    },
  );
  const globalParticipation = totals.registrations
    ? Math.round((totals.engaged / totals.registrations) * 100)
    : 0;

  return (
    <>
      <header className="module-header analytics-module-header">
        <div>
          <p className="eyebrow">VISIÓN GLOBAL</p>
          <h1>Analítica</h1>
          <p>{isAdmin ? "Resultados consolidados de todos los eventos." : "Resultados consolidados de tus eventos."}</p>
        </div>
        <span>Datos actualizados al abrir esta página</span>
      </header>
      {isAdmin && (
        <AnalyticsFilters
          organizers={organizers}
          events={allEvents}
          value={filter}
        />
      )}

      <section className="analytics-kpis global" aria-label="Indicadores globales">
        <article>
          <span className="analytics-kpi-icon purple"><AdminIcon name="users" /></span>
          <div><small>REGISTROS</small><strong>{totals.registrations.toLocaleString("es-CO")}</strong><p>en {eventRecords.length} eventos</p></div>
        </article>
        <article>
          <span className="analytics-kpi-icon blue"><AdminIcon name="activity" /></span>
          <div><small>VISITAS A SALA</small><strong>{totals.roomVisitors.toLocaleString("es-CO")}</strong><p>accesos individuales</p></div>
        </article>
        <article>
          <span className="analytics-kpi-icon green"><AdminIcon name="attendance" /></span>
          <div><small>PARTICIPACIÓN</small><strong>{globalParticipation}%</strong><p>{totals.engaged} participantes activos</p></div>
        </article>
        <article>
          <span className="analytics-kpi-icon amber"><AdminIcon name="mail" /></span>
          <div><small>MENSAJES PREPARADOS</small><strong>{totals.readyMessages.toLocaleString("es-CO")}</strong><p>en cola o programados</p></div>
        </article>
      </section>

      <div className="global-analytics-grid">
        <section className="panel global-engagement-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">AUDIENCIA</p>
              <h2>Interacción consolidada</h2>
              <p>Actividad acumulada de las salas.</p>
            </div>
          </div>
          <div className="global-engagement-content">
            <div
              className="analytics-ring"
              role="img"
              aria-label={`${globalParticipation}% de participación global`}
              style={{
                background: `conic-gradient(#6946df ${Math.min(100, globalParticipation) * 3.6}deg, #ece9f3 0deg)`,
              }}
            >
              <div><strong>{globalParticipation}%</strong><small>participación</small></div>
            </div>
            <div>
              <p><span>Preguntas</span><b>{totals.questions}</b></p>
              <p><span>Votos</span><b>{totals.votes}</b></p>
              <p><span>Personas activas</span><b>{totals.engaged}</b></p>
            </div>
          </div>
        </section>

        <section className="panel global-readiness-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PREPARACIÓN TÉCNICA</p>
              <h2>Sesiones de streaming</h2>
              <p>Sesiones listas para transmitir.</p>
            </div>
          </div>
          <div className="global-readiness-content">
            <strong>{totals.readyStreams}<span> / {totals.sessions}</span></strong>
            <p>sesiones listas o en vivo</p>
            <div>
              <span
                style={{
                  width: `${totals.sessions ? Math.round((totals.readyStreams / totals.sessions) * 100) : 0}%`,
                }}
              />
            </div>
            <small>Las sesiones pendientes se completan desde la pestaña Transmisión de cada evento.</small>
          </div>
        </section>
      </div>

      <AnalyticsCharts
        events={eventRecords.map((event) => ({ id: event.id, title: event.title }))}
        dailyRegistrations={dailyRegistrations}
        statusDistribution={statusDistribution}
      />

      <section className="panel analytics-events-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">COMPARACIÓN</p>
            <h2>Rendimiento por evento</h2>
            <p>Registro, interacción y preparación en una sola vista.</p>
          </div>
          <span>{eventMetrics.length} eventos</span>
        </div>
        {eventMetrics.length ? (
          <div className="analytics-event-table">
            <div className="analytics-event-head">
              <span>Evento</span>
              <span>Registros</span>
              <span>Participación</span>
              <span>Interacciones</span>
              <span>Streaming</span>
              <span />
            </div>
            {eventMetrics.map(({ event, analytics }) => {
              const streamingReady =
                analytics.streaming.ready + analytics.streaming.live;
              return (
                <article key={event.id}>
                  <div className="analytics-event-name">
                    <span className={event.format}>
                      <AdminIcon
                        name={
                          event.format === "live"
                            ? "event-live"
                            : event.format === "hybrid"
                              ? "event-hybrid"
                              : "event-simulated"
                        }
                      />
                    </span>
                    <p>
                      <b>{event.title}</b>
                      <small>{formatEventDate(event.startsAt, event.timezone)} · {statusLabels[event.status]}</small>
                    </p>
                  </div>
                  <div><b>{analytics.registration.total}</b><small>{analytics.registration.confirmed} confirmados</small></div>
                  <div className="analytics-table-progress">
                    <p><b>{analytics.interaction.participationRate}%</b><small>{analytics.interaction.uniqueParticipants} activos</small></p>
                    <div><span style={{ width: `${Math.min(100, analytics.interaction.participationRate)}%` }} /></div>
                  </div>
                  <div><b>{analytics.interaction.questions + analytics.interaction.votes}</b><small>{analytics.interaction.questions} preguntas · {analytics.interaction.votes} votos</small></div>
                  <div>
                    <span className={`analytics-stream-status ${streamingReady ? "ready" : "pending"}`}>
                      {streamingReady ? `${streamingReady} lista${streamingReady === 1 ? "" : "s"}` : "Pendiente"}
                    </span>
                  </div>
                  <Link href={`/events/${event.slug}`}>Ver evento <AdminIcon name="arrow-right" /></Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="module-empty">
            <span><AdminIcon name="analytics" /></span>
            <h2>Aún no hay datos para analizar</h2>
            <p>Crea tu primer evento para comenzar a medir resultados.</p>
          </div>
        )}
      </section>
    </>
  );
}
