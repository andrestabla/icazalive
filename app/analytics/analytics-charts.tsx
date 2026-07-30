"use client";

import { useMemo, useRef, useState } from "react";

type DailyRow = { eventId: string; day: string; total: number };
type StatusRow = { eventId: string; status: string; total: number };

const statusMeta: Record<string, { label: string; color: string }> = {
  registered: { label: "Registrado", color: "#6946df" },
  confirmed: { label: "Confirmado", color: "#2f9b77" },
  attended: { label: "Asistió", color: "#2b78c8" },
  absent: { label: "No asistió", color: "#c98a2f" },
  cancelled: { label: "Cancelado", color: "#b0455a" },
};

const DAYS_WINDOW = 30;

function lastDays(count: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(today.getTime() - index * 24 * 60 * 60 * 1000);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

function shortDay(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

function downloadSvgAsPng(svg: SVGSVGElement | null, filename: string) {
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.style.background = "#ffffff";
  const serialized = new XMLSerializer().serializeToString(clone);
  const image = new Image();
  const width = svg.viewBox.baseVal.width || svg.clientWidth;
  const height = svg.viewBox.baseVal.height || svg.clientHeight;
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = filename;
    link.click();
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
}

export default function AnalyticsCharts({
  events,
  dailyRegistrations,
  statusDistribution,
}: {
  events: { id: string; title: string }[];
  dailyRegistrations: DailyRow[];
  statusDistribution: StatusRow[];
}) {
  const [eventFilter, setEventFilter] = useState("all");
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [hoverStatus, setHoverStatus] = useState<string | null>(null);
  const lineRef = useRef<SVGSVGElement>(null);
  const donutRef = useRef<SVGSVGElement>(null);

  const days = useMemo(() => lastDays(DAYS_WINDOW), []);

  const series = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const row of dailyRegistrations) {
      if (eventFilter !== "all" && row.eventId !== eventFilter) continue;
      byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.total);
    }
    return days.map((day) => ({ day, total: byDay.get(day) ?? 0 }));
  }, [dailyRegistrations, days, eventFilter]);

  const distribution = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const row of statusDistribution) {
      if (eventFilter !== "all" && row.eventId !== eventFilter) continue;
      byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + row.total);
    }
    return Object.keys(statusMeta)
      .map((status) => ({ status, total: byStatus.get(status) ?? 0 }))
      .filter((item) => item.total > 0);
  }, [statusDistribution, eventFilter]);

  // Geometría del gráfico de líneas
  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 16, bottom: 30, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...series.map((point) => point.total));
  const stepX = chartWidth / (series.length - 1);
  const pointX = (index: number) => padding.left + index * stepX;
  const pointY = (value: number) =>
    padding.top + chartHeight - (value / maxValue) * chartHeight;
  const linePath = series
    .map((point, index) => `${index === 0 ? "M" : "L"}${pointX(index).toFixed(1)},${pointY(point.total).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${pointX(series.length - 1).toFixed(1)},${(padding.top + chartHeight).toFixed(1)} L${padding.left},${(padding.top + chartHeight).toFixed(1)} Z`;
  const totalWindow = series.reduce((sum, point) => sum + point.total, 0);

  // Geometría de la dona
  const donutSize = 190;
  const radius = 74;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;
  const distributionTotal = distribution.reduce((sum, item) => sum + item.total, 0);
  let accumulated = 0;
  const segments = distribution.map((item) => {
    const fraction = distributionTotal ? item.total / distributionTotal : 0;
    const segment = {
      ...item,
      fraction,
      offset: accumulated,
    };
    accumulated += fraction;
    return segment;
  });

  return (
    <section className="panel analytics-charts-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">TENDENCIAS</p>
          <h2>Gráficos interactivos</h2>
          <p>Registros por día y distribución por estado. Pasa el cursor para ver el detalle.</p>
        </div>
        <label className="filter-select">
          <span>Evento</span>
          <select value={eventFilter} onChange={(input) => setEventFilter(input.target.value)}>
            <option value="all">Todos los eventos</option>
            {events.map((event) => (
              <option value={event.id} key={event.id}>{event.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="analytics-charts-grid">
        <article className="analytics-line-card">
          <header>
            <div>
              <b>Registros por día</b>
              <small>Últimos {DAYS_WINDOW} días · {totalWindow} registro{totalWindow === 1 ? "" : "s"}</small>
            </div>
            <button onClick={() => downloadSvgAsPng(lineRef.current, "registros-por-dia.png")}>
              Descargar PNG ↓
            </button>
          </header>
          <svg
            ref={lineRef}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Serie de registros por día de los últimos 30 días"
            onMouseLeave={() => setHoverDay(null)}
            onMouseMove={(mouse) => {
              const rect = mouse.currentTarget.getBoundingClientRect();
              const x = ((mouse.clientX - rect.left) / rect.width) * width;
              const index = Math.round((x - padding.left) / stepX);
              setHoverDay(Math.max(0, Math.min(series.length - 1, index)));
            }}
          >
            {[0, 0.5, 1].map((fraction) => {
              const y = padding.top + chartHeight - fraction * chartHeight;
              return (
                <g key={fraction}>
                  <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#eeecf3" />
                  <text x={padding.left - 7} y={y + 4} textAnchor="end" fontSize="10" fill="#a09cab">
                    {Math.round(fraction * maxValue)}
                  </text>
                </g>
              );
            })}
            {series.map((point, index) =>
              index % 5 === 0 || index === series.length - 1 ? (
                <text
                  key={point.day}
                  x={pointX(index)}
                  y={height - 9}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a09cab"
                >
                  {shortDay(point.day)}
                </text>
              ) : null,
            )}
            <path d={areaPath} fill="#6946df18" />
            <path d={linePath} fill="none" stroke="#6946df" strokeWidth="2.5" strokeLinejoin="round" />
            {hoverDay !== null && (
              <g>
                <line
                  x1={pointX(hoverDay)}
                  x2={pointX(hoverDay)}
                  y1={padding.top}
                  y2={padding.top + chartHeight}
                  stroke="#c9c0ec"
                  strokeDasharray="3 3"
                />
                <circle cx={pointX(hoverDay)} cy={pointY(series[hoverDay].total)} r="4.5" fill="#6946df" stroke="#fff" strokeWidth="2" />
                <g transform={`translate(${Math.min(width - 130, Math.max(padding.left, pointX(hoverDay) - 55))}, ${padding.top})`}>
                  <rect width="112" height="34" rx="7" fill="#221c3f" opacity="0.94" />
                  <text x="10" y="14" fontSize="10" fill="#cabfff">{shortDay(series[hoverDay].day)}</text>
                  <text x="10" y="27" fontSize="11" fill="#ffffff" fontWeight="700">
                    {series[hoverDay].total} registro{series[hoverDay].total === 1 ? "" : "s"}
                  </text>
                </g>
              </g>
            )}
          </svg>
        </article>

        <article className="analytics-donut-card">
          <header>
            <div>
              <b>Estados de registro</b>
              <small>{distributionTotal} registro{distributionTotal === 1 ? "" : "s"} en total</small>
            </div>
            <button onClick={() => downloadSvgAsPng(donutRef.current, "estados-de-registro.png")}>
              Descargar PNG ↓
            </button>
          </header>
          {distributionTotal ? (
            <div className="analytics-donut-content">
              <svg
                ref={donutRef}
                viewBox={`0 0 ${donutSize} ${donutSize}`}
                role="img"
                aria-label="Distribución de registros por estado"
              >
                {segments.map((segment) => (
                  <circle
                    key={segment.status}
                    cx={donutSize / 2}
                    cy={donutSize / 2}
                    r={radius}
                    fill="none"
                    stroke={statusMeta[segment.status].color}
                    strokeWidth={hoverStatus === segment.status ? strokeWidth + 5 : strokeWidth}
                    strokeDasharray={`${(segment.fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`}
                    strokeDashoffset={(-segment.offset * circumference).toFixed(2)}
                    transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                    opacity={hoverStatus && hoverStatus !== segment.status ? 0.35 : 1}
                    onMouseEnter={() => setHoverStatus(segment.status)}
                    onMouseLeave={() => setHoverStatus(null)}
                  />
                ))}
                <text x={donutSize / 2} y={donutSize / 2 - 3} textAnchor="middle" fontSize="24" fontWeight="750" fill="#17152f">
                  {hoverStatus
                    ? distribution.find((item) => item.status === hoverStatus)?.total ?? 0
                    : distributionTotal}
                </text>
                <text x={donutSize / 2} y={donutSize / 2 + 16} textAnchor="middle" fontSize="10" fill="#8f8b97">
                  {hoverStatus ? statusMeta[hoverStatus].label : "registros"}
                </text>
              </svg>
              <ul className="analytics-donut-legend">
                {segments.map((segment) => (
                  <li
                    key={segment.status}
                    className={hoverStatus === segment.status ? "active" : ""}
                    onMouseEnter={() => setHoverStatus(segment.status)}
                    onMouseLeave={() => setHoverStatus(null)}
                  >
                    <i style={{ background: statusMeta[segment.status].color }} />
                    <span>{statusMeta[segment.status].label}</span>
                    <b>{segment.total}</b>
                    <small>{Math.round(segment.fraction * 100)}%</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="analytics-donut-empty">Sin registros para el filtro seleccionado.</div>
          )}
        </article>
      </div>
    </section>
  );
}
