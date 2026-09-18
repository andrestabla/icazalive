// Reglas por patrón para textos que se arman en tiempo de ejecución (fechas
// formateadas en español, contadores, plurales). Se aplican cuando el texto
// exacto no está en el diccionario.
export type Rule = { re: RegExp; to: string | ((...groups: string[]) => string) };

const MONTHS: Record<string, string> = {
  enero: "January", febrero: "February", marzo: "March", abril: "April", mayo: "May", junio: "June",
  julio: "July", agosto: "August", septiembre: "September", setiembre: "September", octubre: "October",
  noviembre: "November", diciembre: "December",
};
const SHORT_MONTHS: Record<string, string> = {
  ene: "Jan", feb: "Feb", mar: "Mar", abr: "Apr", may: "May", jun: "Jun", jul: "Jul", ago: "Aug",
  sep: "Sep", sept: "Sep", oct: "Oct", nov: "Nov", dic: "Dec",
};
const WEEKDAYS: Record<string, string> = {
  lunes: "Monday", martes: "Tuesday", miércoles: "Wednesday", jueves: "Thursday", viernes: "Friday",
  sábado: "Saturday", domingo: "Sunday",
};
const monthAlt = Object.keys(MONTHS).join("|");
const shortAlt = Object.keys(SHORT_MONTHS).sort((a, b) => b.length - a.length).join("|");
const weekdayAlt = Object.keys(WEEKDAYS).join("|");

function keepCase(source: string, value: string) {
  if (source === source.toUpperCase()) return value.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return value[0].toUpperCase() + value.slice(1);
  return value;
}
const month = (m: string) => keepCase(m, MONTHS[m.toLowerCase()] ?? m);
const shortMonth = (m: string) => keepCase(m, SHORT_MONTHS[m.toLowerCase().replace(/\.$/, "")] ?? m);
const weekday = (d: string) => keepCase(d, WEEKDAYS[d.toLowerCase()] ?? d);

export const RULES: Rule[] = [
  // "martes, 16 de abril de 2027" / "16 de abril de 2027" / "16 de abril"
  { re: new RegExp(`\\b(${weekdayAlt}),? (\\d{1,2}) de (${monthAlt}) de (\\d{4})\\b`, "gi"), to: (_m, d, n, mo, y) => `${weekday(d)}, ${month(mo)} ${n}, ${y}` },
  { re: new RegExp(`\\b(${weekdayAlt}),? (\\d{1,2}) de (${monthAlt})\\b`, "gi"), to: (_m, d, n, mo) => `${weekday(d)}, ${month(mo)} ${n}` },
  { re: new RegExp(`\\b(\\d{1,2}) de (${monthAlt}) de (\\d{4})\\b`, "gi"), to: (_m, n, mo, y) => `${month(mo)} ${n}, ${y}` },
  { re: new RegExp(`\\b(\\d{1,2}) de (${monthAlt})\\b`, "gi"), to: (_m, n, mo) => `${month(mo)} ${n}` },
  { re: new RegExp(`\\b(${monthAlt}) de (\\d{4})\\b`, "gi"), to: (_m, mo, y) => `${month(mo)} ${y}` },
  // "16 de sept de 2026" (mes corto con "de")
  { re: new RegExp(`\\b(\\d{1,2}) de (${shortAlt})\\.? de (\\d{4})\\b`, "gi"), to: (_m, n, mo, y) => `${shortMonth(mo)} ${n}, ${y}` },
  { re: new RegExp(`\\b(\\d{1,2}) de (${shortAlt})\\.?(?=\\s|$|·|,)`, "gi"), to: (_m, n, mo) => `${shortMonth(mo)} ${n}` },
  // "16 abr 2026", "16 sept 2026", "16 abr."
  { re: new RegExp(`\\b(\\d{1,2}) (${shortAlt})\\.? (\\d{4})\\b`, "gi"), to: (_m, n, mo, y) => `${shortMonth(mo)} ${n}, ${y}` },
  { re: new RegExp(`\\b(\\d{1,2}) (${shortAlt})\\.?(?=\\s|$|·|,)`, "gi"), to: (_m, n, mo) => `${shortMonth(mo)} ${n}` },
  // Mes solo (fichas de fecha: "ABR", "sept")
  { re: new RegExp(`^(${shortAlt})\\.?$`, "i"), to: (_m, mo) => shortMonth(mo) },
  { re: new RegExp(`^(${monthAlt})$`, "i"), to: (_m, mo) => month(mo) },
  { re: new RegExp(`^(${weekdayAlt})$`, "i"), to: (_m, d) => weekday(d) },
  // Horas "8:00 p. m." / "a. m."
  { re: /\bp\.\s?m\./g, to: "PM" },
  { re: /\ba\.\s?m\./g, to: "AM" },
  // Relativos
  { re: /^Hace (\d+) min$/, to: "$1 min ago" },
  { re: /^Hace (\d+) h$/, to: "$1 h ago" },
  { re: /^Hace (\d+) días?$/, to: (_m, n) => `${n} day${n === "1" ? "" : "s"} ago` },
  { re: /^hace (\d+) min$/, to: "$1 min ago" },
  { re: /^hace (\d+) h$/, to: "$1 h ago" },
  { re: /^hace (\d+) días?$/, to: (_m, n) => `${n} day${n === "1" ? "" : "s"} ago` },
  { re: /^hace un momento$/i, to: "just now" },
  // Duraciones y contadores frecuentes
  { re: /^(\d+) min$/, to: "$1 min" },
  { re: /^(\d+) h (\d+) min$/, to: "$1 h $2 min" },
  { re: /^(\d+) minutos?$/, to: (_m, n) => `${n} minute${n === "1" ? "" : "s"}` },
  { re: /^(\d+) horas?$/, to: (_m, n) => `${n} hour${n === "1" ? "" : "s"}` },
  { re: /^(\d+) días?$/, to: (_m, n) => `${n} day${n === "1" ? "" : "s"}` },
  { re: /^(\d+) semanas?$/, to: (_m, n) => `${n} week${n === "1" ? "" : "s"}` },
  { re: /^(\d+) eventos?$/, to: (_m, n) => `${n} event${n === "1" ? "" : "s"}` },
  { re: /^(\d+) participantes?$/, to: (_m, n) => `${n} participant${n === "1" ? "" : "s"}` },
  { re: /^(\d+) registrados?$/, to: "$1 registered" },
  { re: /^(\d+) inscritos?$/, to: "$1 registered" },
  { re: /^(\d+) activos?$/, to: "$1 active" },
  { re: /^(\d+) asistentes?$/, to: (_m, n) => `${n} attendee${n === "1" ? "" : "s"}` },
  { re: /^(\d+) sesiones$/, to: "$1 sessions" },
  { re: /^(\d+) sesión$/, to: "$1 session" },
  { re: /^(\d+) mensajes?$/, to: (_m, n) => `${n} message${n === "1" ? "" : "s"}` },
  { re: /^(\d+) preguntas?$/, to: (_m, n) => `${n} question${n === "1" ? "" : "s"}` },
  { re: /^(\d+) votos?$/, to: (_m, n) => `${n} vote${n === "1" ? "" : "s"}` },
  { re: /^(\d+) elementos?$/, to: (_m, n) => `${n} item${n === "1" ? "" : "s"}` },
  { re: /^(\d+) seleccionados?$/, to: "$1 selected" },
  { re: /^(\d+) resultados?$/, to: (_m, n) => `${n} result${n === "1" ? "" : "s"}` },
  { re: /^(\d+) filas?$/, to: (_m, n) => `${n} row${n === "1" ? "" : "s"}` },
  { re: /^de (\d[\d.,]*)$/, to: "of $1" },
  { re: /^en (\d+) eventos?$/, to: (_m, n) => `across ${n} event${n === "1" ? "" : "s"}` },
  { re: /^Hasta (\d[\d.,]*) asistentes$/, to: "Up to $1 attendees" },
  { re: /^Duración (\d+) min$/, to: "Duration $1 min" },
  { re: /^(\d+) horas? antes del evento$/, to: (_m, n) => `${n} hour${n === "1" ? "" : "s"} before the event` },
  { re: /^(\d+) horas? después del evento$/, to: (_m, n) => `${n} hour${n === "1" ? "" : "s"} after the event` },
  { re: /^(\d+) días? antes del evento$/, to: (_m, n) => `${n} day${n === "1" ? "" : "s"} before the event` },
  { re: /^(\d+) días? después del evento$/, to: (_m, n) => `${n} day${n === "1" ? "" : "s"} after the event` },
  { re: /^(\d+) minutos? antes del evento$/, to: (_m, n) => `${n} minute${n === "1" ? "" : "s"} before the event` },
  { re: /^(\d+) minutos? después del evento$/, to: (_m, n) => `${n} minute${n === "1" ? "" : "s"} after the event` },
  { re: /^(\d+) día después del evento · solo a quienes no entraron$/, to: "$1 day after the event · only to those who did not join" },
  { re: /^(\d+) días después del evento · solo a quienes no entraron$/, to: "$1 days after the event · only to those who did not join" },
  { re: /^(\d+) horas? después del evento · solo a quienes no entraron$/, to: (_m, n) => `${n} hour${n === "1" ? "" : "s"} after the event · only to those who did not join` },
  { re: /^Página (\d+) de (\d+)$/, to: "Page $1 of $2" },
  { re: /^(\d+) de (\d+)$/, to: "$1 of $2" },
  { re: /^(\d+)% de participación global$/, to: "$1% overall participation" },
  { re: /^Creado (.+)$/, to: "Created $1" },
  { re: /^Actualizado (.+)$/, to: "Updated $1" },
  { re: /^Publicado (.+)$/, to: "Published $1" },
  { re: /^Rol de (.+)$/, to: "Role of $1" },
  { re: /^Bienvenid[oa],? (.+)$/, to: "Welcome, $1" },
  { re: /^Hola,? (.+)$/, to: "Hello, $1" },
];
