// Plantillas de comunicación por defecto de la plataforma. Se precargan al
// crear un evento sin plantilla y pueden editarse después en la pestaña
// Comunicaciones de cada evento.
export const DEFAULT_COMMUNICATIONS = [
  {
    type: "registration_confirmation" as const,
    subject: "Tu registro a {{event_title}} está confirmado",
    body: "Hola {{participant_name}},\n\nTu registro a {{event_title}} está confirmado.\n\nFecha: {{event_date}}\nEntrar al evento: {{access_link}}\n\nTe esperamos,\nEquipo Icaza Jammoul Live",
    enabled: true,
    offsetMinutes: 0,
  },
  {
    type: "reminder_24h" as const,
    subject: "Mañana: {{event_title}}",
    body: "Hola {{participant_name}},\n\nTe recordamos que {{event_title}} comienza mañana.\n\nFecha: {{event_date}}\nEntrar al evento: {{access_link}}\n\nEquipo Icaza Jammoul Live",
    enabled: true,
    offsetMinutes: -1440,
  },
  {
    type: "reminder_1h" as const,
    subject: "En una hora comenzamos: {{event_title}}",
    body: "Hola {{participant_name}},\n\nEn una hora comienza {{event_title}}. Entrar al evento: {{access_link}}\n\nEquipo Icaza Jammoul Live",
    enabled: true,
    offsetMinutes: -60,
  },
  {
    type: "post_event" as const,
    subject: "Gracias por acompañarnos en {{event_title}}",
    body: "Hola {{participant_name}},\n\nGracias por participar en {{event_title}}. Muy pronto compartiremos los recursos y la grabación.\n\nEquipo Icaza Jammoul Live",
    enabled: false,
    offsetMinutes: 60,
  },
];
