import { writeAuditLog } from "@/lib/audit";
import { getBrandSettings } from "@/lib/brand";
import { renderBrandedEmail } from "@/lib/email-branding";
import { sendEmail } from "@/lib/email-provider";

export type TeamAccessKind = "created" | "promoted" | "role_changed" | "password_reset";

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrador",
  organizer: "Organizador",
  participant: "Participante",
};

// Correo de acceso al equipo: se envía al crear un miembro, al dar rol de
// gestor/administrador a un participante existente, al cambiar el rol o al
// restablecer la contraseña. Nunca bloquea la respuesta HTTP: se dispara con
// after() y deja rastro en auditoría.
export async function sendTeamAccessEmail(options: {
  kind: TeamAccessKind;
  to: string;
  name: string;
  role: string;
  previousRole?: string | null;
  temporaryPassword?: string | null;
  origin: string;
  actorEmail?: string | null;
}): Promise<void> {
  const brand = await getBrandSettings().catch(() => null);
  const organization = brand?.organizationName ?? "Icaza Jammoul Live";
  const roleLabel = ROLE_LABELS[options.role] ?? options.role;
  const loginUrl = `${options.origin.replace(/\/+$/, "")}/login`;

  let subject: string;
  let intro: string;
  switch (options.kind) {
    case "created":
      subject = `Tu acceso a ${organization} como ${roleLabel}`;
      intro = `Te creamos una cuenta en ${organization} con el rol de ${roleLabel}.`;
      break;
    case "promoted":
      subject = `Ahora eres ${roleLabel} en ${organization}`;
      intro = `Tu cuenta de participante en ${organization} ahora tiene el rol de ${roleLabel}. Ya puedes entrar al panel de gestión.`;
      break;
    case "role_changed":
      subject = `Tu rol en ${organization} cambió a ${roleLabel}`;
      intro = `Tu rol en ${organization} pasó de ${ROLE_LABELS[options.previousRole ?? ""] ?? options.previousRole ?? "otro rol"} a ${roleLabel}. Si tenías una sesión abierta, vuelve a iniciarla.`;
      break;
    case "password_reset":
      subject = `Nueva contraseña temporal para ${organization}`;
      intro = `Se restableció la contraseña de tu cuenta en ${organization}.`;
      break;
  }

  const lines = [`Hola ${options.name},`, "", intro];
  if (options.temporaryPassword) {
    lines.push(
      "",
      `Correo de acceso: ${options.to}`,
      `Contraseña temporal: ${options.temporaryPassword}`,
      "",
      "Cámbiala en cuanto entres, desde tu perfil.",
    );
  }
  if (options.role !== "participant") {
    lines.push("", `Iniciar sesión: ${loginUrl}`);
  }
  lines.push("", `Equipo ${organization}`);
  const body = lines.join("\n");

  const result = await sendEmail({
    to: options.to,
    subject,
    body,
    html: renderBrandedEmail({ bodyText: body, brand }),
  });

  await writeAuditLog({
    actorEmail: options.actorEmail ?? null,
    action: result.ok ? "team.notification.sent" : "team.notification.failed",
    resourceType: "team_member",
    resourceId: options.to,
    outcome: result.ok ? "success" : "failure",
    summary: result.ok
      ? `Correo de acceso (${options.kind}) enviado a ${options.to}.`
      : `No se pudo enviar el correo de acceso (${options.kind}) a ${options.to}: ${result.error}`,
    details: { kind: options.kind, role: options.role },
  });
}
