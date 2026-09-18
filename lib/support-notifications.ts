import { writeAuditLog } from "@/lib/audit";
import { getBrandSettings } from "@/lib/brand";
import { renderBrandedEmail } from "@/lib/email-branding";
import { sendEmail } from "@/lib/email-provider";
import { getSupportContact, SUPPORT_STATUS_LABELS, supportTicketNumber, supportTicketPath, type SupportStatus } from "@/lib/support";

type TicketSummary = {
  id: string;
  subject: string;
  requesterName: string;
  requesterEmail: string;
  status: SupportStatus | string;
};

async function deliver(to: string, subject: string, lines: string[], action: string, ticketId: string) {
  const brand = await getBrandSettings().catch(() => null);
  const body = lines.join("\n");
  const result = await sendEmail({ to, subject, body, html: renderBrandedEmail({ bodyText: body, brand }) });
  await writeAuditLog({
    action: result.ok ? `${action}.sent` : `${action}.failed`,
    resourceType: "support_request",
    resourceId: ticketId,
    outcome: result.ok ? "success" : "failure",
    summary: result.ok ? `Correo de soporte enviado a ${to}.` : `No se pudo enviar el correo de soporte a ${to}: ${result.error}`,
    details: { to },
  });
}

// Al crear un caso: confirmación al solicitante (con su enlace de seguimiento)
// y aviso a los agentes de soporte.
export async function notifySupportRequestCreated(options: { ticket: TicketSummary; token: string; origin: string; category: string }) {
  const { ticket, token, origin } = options;
  const contact = await getSupportContact();
  const organization = (await getBrandSettings().catch(() => null))?.organizationName ?? "Icaza Jammoul Live";
  const number = supportTicketNumber(ticket.id);
  const link = `${origin.replace(/\/+$/, "")}${supportTicketPath(token)}`;
  await deliver(
    ticket.requesterEmail,
    `Recibimos tu caso ${number} · ${organization}`,
    [
      `Hola ${ticket.requesterName},`,
      "",
      `Registramos tu solicitud de soporte ${number}: "${ticket.subject}".`,
      "Nuestro equipo la revisará y te avisaremos por este correo con cada avance.",
      "",
      `Ver mi caso y adjuntar evidencias: ${link}`,
      "",
      `Horario de atención: ${contact.hours}`,
      `Equipo ${organization}`,
    ],
    "support.notification.requester",
    ticket.id,
  );
  const desk = `${origin.replace(/\/+$/, "")}/support?case=${ticket.id}`;
  for (const email of contact.emails) {
    await deliver(
      email,
      `Nuevo caso de soporte ${number}: ${ticket.subject}`,
      [
        "Hola,",
        "",
        `${ticket.requesterName} (${ticket.requesterEmail}) abrió el caso ${number} en la categoría ${options.category}.`,
        `Asunto: ${ticket.subject}`,
        "",
        `Gestionar el caso: ${desk}`,
        "",
        `Equipo ${organization}`,
      ],
      "support.notification.agent",
      ticket.id,
    );
  }
}

// Al cambiar el estado o responder: aviso al solicitante.
export async function notifySupportRequesterUpdate(options: {
  ticket: TicketSummary;
  token: string | null;
  origin: string;
  kind: "status" | "reply";
  message?: string;
  actorName: string;
}) {
  const { ticket, token, origin } = options;
  const organization = (await getBrandSettings().catch(() => null))?.organizationName ?? "Icaza Jammoul Live";
  const number = supportTicketNumber(ticket.id);
  const status = SUPPORT_STATUS_LABELS[ticket.status as SupportStatus] ?? ticket.status;
  const link = token ? `${origin.replace(/\/+$/, "")}${supportTicketPath(token)}` : null;
  const lines = [`Hola ${ticket.requesterName},`, ""];
  if (options.kind === "status") {
    lines.push(`Tu caso ${number} ("${ticket.subject}") cambió de estado a: ${status}.`);
  } else {
    lines.push(`${options.actorName} respondió a tu caso ${number} ("${ticket.subject}"):`, "", options.message ?? "");
  }
  if (link) lines.push("", `Ver mi caso y responder: ${link}`);
  lines.push("", `Equipo ${organization}`);
  await deliver(
    ticket.requesterEmail,
    options.kind === "status" ? `Tu caso ${number} está ${status.toLowerCase()} · ${organization}` : `Respuesta a tu caso ${number} · ${organization}`,
    lines,
    "support.notification.requester",
    ticket.id,
  );
}

// Cuando el solicitante responde o adjunta evidencias: aviso al agente
// asignado o, si no hay, a todos los agentes.
export async function notifySupportAgentsOfActivity(options: { ticket: TicketSummary; origin: string; agentEmails: string[]; summary: string }) {
  const organization = (await getBrandSettings().catch(() => null))?.organizationName ?? "Icaza Jammoul Live";
  const number = supportTicketNumber(options.ticket.id);
  const desk = `${options.origin.replace(/\/+$/, "")}/support?case=${options.ticket.id}`;
  const recipients = options.agentEmails.length ? options.agentEmails : (await getSupportContact()).emails;
  for (const email of recipients) {
    await deliver(
      email,
      `Actividad en el caso ${number}: ${options.ticket.subject}`,
      ["Hola,", "", `${options.ticket.requesterName} ${options.summary} en el caso ${number}.`, "", `Gestionar el caso: ${desk}`, "", `Equipo ${organization}`],
      "support.notification.agent",
      options.ticket.id,
    );
  }
}
