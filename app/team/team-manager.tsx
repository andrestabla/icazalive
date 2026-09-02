"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

type StaffRole = "administrator" | "organizer";
type AssignableRole = StaffRole | "participant";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "administrator" | "organizer" | "participant";
  active: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const roleLabels = {
  administrator: "Administrador",
  organizer: "Organizador",
  participant: "Participante",
};

function formatStableDate(value: string) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PLATFORM_TIMEZONE,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value.replace(/\s+/g, " ") ?? "";
  return `${part("day")} ${part("month")} ${part("year")} · ${part("hour")}:${part("minute")} ${part("dayPeriod")}`.trim();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function temporaryPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(8);
  window.crypto.getRandomValues(values);
  return `Live!${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}7`;
}

export default function TeamManager({
  currentUserId,
  serverTime,
  initialMembers,
}: {
  currentUserId: string;
  serverTime: string;
  initialMembers: TeamMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetMember, setResetMember] = useState<TeamMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [createdAccess, setCreatedAccess] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeMembers = members.filter((member) => member.active).length;
  const administrators = members.filter(
    (member) => member.active && member.role === "administrator",
  ).length;
  const recentAccess = members.filter((member) => member.lastLoginAt).length;

  const openInvite = () => {
    setGeneratedPassword(temporaryPassword());
    setCreatedAccess(null);
    setError("");
    setInviteOpen(true);
  };

  const createMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving("invite");
    setError("");
    const form = new FormData(event.currentTarget);
    const access = {
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    };
    const response = await fetch("/api/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...access,
        role: form.get("role"),
      }),
    });
    const payload = (await response.json()) as {
      data?: TeamMember & { promoted?: boolean };
      error?: string;
    };
    if (response.ok && payload.data) {
      const created = payload.data;
      setMembers((current) => [...current.filter((item) => item.id !== created.id), created]);
      setCreatedAccess(access);
      setMessage(
        created.promoted
          ? `${access.name} ya era participante: ahora tiene rol de ${roleLabels[created.role]} y recibió el acceso por correo.`
          : `${access.name} recibió su acceso por correo.`,
      );
    } else {
      setError(payload.error ?? "No fue posible crear la cuenta.");
    }
    setSaving(null);
  };

  const patchMember = async (
    member: TeamMember,
    changes: { role?: AssignableRole; active?: boolean; password?: string },
  ) => {
    setSaving(member.id);
    setMessage("");
    setError("");
    const response = await fetch("/api/team", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: member.id, ...changes }),
    });
    const payload = (await response.json()) as {
      data?: TeamMember;
      error?: string;
    };
    if (response.ok && payload.data) {
      // Al volver a participante, la persona sale del equipo (conserva su historial).
      setMembers((current) =>
        payload.data!.role === "participant"
          ? current.filter((item) => item.id !== member.id)
          : current.map((item) => (item.id === member.id ? payload.data! : item)),
      );
      setMessage(
        changes.password
          ? `La contraseña de ${member.name} fue restablecida y se le envió por correo.`
          : changes.role === "participant"
            ? `${member.name} vuelve a ser participante; se le avisó por correo.`
            : `Acceso de ${member.name} actualizado; se le avisó por correo.`,
      );
      if (changes.password) {
        setCreatedAccess({
          name: member.name,
          email: member.email,
          password: changes.password,
        });
        setResetMember(null);
      }
    } else {
      setError(payload.error ?? "No fue posible actualizar el acceso.");
    }
    setSaving(null);
  };

  const removeMember = async (member: TeamMember) => {
    setSaving(member.id);
    setMessage("");
    setError("");
    const response = await fetch("/api/team", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: member.id }),
    });
    const payload = (await response.json()) as { error?: string };
    if (response.ok) {
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setDeleteMember(null);
      setMessage(`La cuenta de ${member.name} fue eliminada definitivamente.`);
    } else {
      setError(payload.error ?? "No fue posible eliminar la cuenta.");
      setDeleteMember(null);
    }
    setSaving(null);
  };

  const copyAccess = async () => {
    if (!createdAccess) return;
    await navigator.clipboard.writeText(
      `Icaza Jammoul Live\nCorreo: ${createdAccess.email}\nContraseña temporal: ${createdAccess.password}`,
    );
    setMessage("Datos de acceso copiados.");
  };

  return (
    <>
      <header className="module-header team-module-header">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Equipo</h1>
          <p>Gestiona quién puede crear eventos y configurar la plataforma.</p>
        </div>
        <button className="primary-button" onClick={openInvite}>＋ Añadir miembro</button>
      </header>

      {message && <div className="detail-message" role="status">{message}</div>}
      {error && <div className="team-error" role="alert">ⓘ {error}</div>}

      <section className="team-stats">
        <article><span className="stat-icon purple">♧</span><div><strong>{members.length}</strong><p>miembros totales</p></div></article>
        <article><span className="stat-icon green">✓</span><div><strong>{activeMembers}</strong><p>accesos activos</p></div></article>
        <article><span className="stat-icon blue">◇</span><div><strong>{administrators}</strong><p>administradores</p></div></article>
        <article><span className="stat-icon orange">↗</span><div><strong>{recentAccess}</strong><p>han iniciado sesión</p></div></article>
      </section>

      <section className="panel team-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">MIEMBROS</p>
            <h2>Acceso al espacio de trabajo</h2>
            <p>Cada alta, cambio de rol o contraseña se notifica por correo y cierra las sesiones abiertas del miembro.</p>
          </div>
          <span>{activeMembers} activos</span>
        </div>
        <div className="team-table">
          <div className="team-table-head">
            <span>MIEMBRO</span><span>ROL</span><span>ÚLTIMO ACCESO</span><span>ESTADO</span><span>ACCIONES</span>
          </div>
          {members.map((member) => {
            const isCurrent = member.id === currentUserId;
            const locked =
              member.lockedUntil &&
              new Date(member.lockedUntil).getTime() >
                new Date(serverTime).getTime();
            return (
              <article key={member.id}>
                <div className="team-person">
                  <span>{initials(member.name)}</span>
                  <p><b>{member.name}{isCurrent && <i>Tú</i>}</b><small>{member.email}</small></p>
                </div>
                <select
                  aria-label={`Rol de ${member.name}`}
                  value={member.role}
                  disabled={isCurrent || saving === member.id}
                  onChange={(input) =>
                    void patchMember(member, {
                      role: input.target.value as AssignableRole,
                    })
                  }
                >
                  <option value="administrator">{roleLabels.administrator}</option>
                  <option value="organizer">{roleLabels.organizer}</option>
                  <option value="participant">{roleLabels.participant} (sale del equipo)</option>
                </select>
                <div className="team-last-access">
                  <b>{member.lastLoginAt ? formatStableDate(member.lastLoginAt) : "Sin ingreso"}</b>
                  <small>Creado {formatStableDate(member.createdAt)}</small>
                </div>
                <span className={`team-status ${locked ? "locked" : member.active ? "active" : "inactive"}`}>
                  {locked ? "Bloqueado" : member.active ? "Activo" : "Inactivo"}
                </span>
                <div className="team-actions">
                  <button
                    disabled={isCurrent || saving === member.id}
                    onClick={() => {
                      setGeneratedPassword(temporaryPassword());
                      setCreatedAccess(null);
                      setResetMember(member);
                    }}
                  >
                    Restablecer
                  </button>
                  <button
                    className={member.active ? "danger" : "activate"}
                    disabled={isCurrent || saving === member.id}
                    onClick={() =>
                      void patchMember(member, { active: !member.active })
                    }
                  >
                    {saving === member.id ? "Guardando…" : member.active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    className="danger"
                    disabled={isCurrent || saving === member.id}
                    onClick={() => setDeleteMember(member)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {inviteOpen && (
        <div className="modal-backdrop" onMouseDown={() => setInviteOpen(false)}>
          <section className="modal team-modal" role="dialog" aria-modal="true" aria-labelledby="team-invite-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setInviteOpen(false)} aria-label="Cerrar">×</button>
            {createdAccess ? (
              <div className="team-access-created">
                <span>✓</span>
                <p className="eyebrow">ACCESO ENVIADO</p>
                <h2 id="team-invite-title">Le enviamos el acceso por correo</h2>
                <p>El miembro recibió un correo con su rol, el enlace de ingreso y esta contraseña temporal. Puedes copiarla por si necesita ayuda.</p>
                <div><small>CORREO</small><b>{createdAccess.email}</b><small>CONTRASEÑA TEMPORAL</small><code>{createdAccess.password}</code></div>
                <button className="primary-button" onClick={() => void copyAccess()}>Copiar credenciales</button>
              </div>
            ) : (
              <>
                <span className="modal-icon">♧</span>
                <p className="eyebrow">NUEVO MIEMBRO</p>
                <h2 id="team-invite-title">Añadir miembro del equipo</h2>
                <p>Recibirá un correo con su acceso. Si el correo ya pertenece a un participante registrado, se le asigna el rol y conserva su historial de eventos.</p>
                <form className="team-invite-form" onSubmit={createMember}>
                  <label>Nombre completo<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
                  <label>Correo electrónico<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
                  <label>Rol<select name="role" defaultValue="organizer"><option value="organizer">Organizador</option><option value="administrator">Administrador</option></select></label>
                  <label>Contraseña temporal<div><input name="password" required minLength={12} maxLength={128} value={generatedPassword} onChange={(input) => setGeneratedPassword(input.target.value)} /><button type="button" onClick={() => setGeneratedPassword(temporaryPassword())}>Generar</button></div></label>
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <button className="primary-button" disabled={saving === "invite"}>{saving === "invite" ? "Creando…" : "Crear cuenta"}</button>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {resetMember && (
        <div className="modal-backdrop" onMouseDown={() => setResetMember(null)}>
          <section className="modal team-modal reset" role="dialog" aria-modal="true" aria-labelledby="team-reset-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setResetMember(null)} aria-label="Cerrar">×</button>
            <span className="modal-icon">↻</span>
            <p className="eyebrow">RESTABLECER ACCESO</p>
            <h2 id="team-reset-title">Nueva contraseña para {resetMember.name}</h2>
            <p>La sesión actual del miembro se cerrará y recibirá la nueva contraseña por correo.</p>
            <div className="team-reset-password"><input aria-label="Nueva contraseña temporal" value={generatedPassword} onChange={(input) => setGeneratedPassword(input.target.value)} /><button onClick={() => setGeneratedPassword(temporaryPassword())}>Generar otra</button></div>
            <button className="primary-button" disabled={saving === resetMember.id} onClick={() => void patchMember(resetMember, { password: generatedPassword })}>{saving === resetMember.id ? "Actualizando…" : "Confirmar restablecimiento"}</button>
          </section>
        </div>
      )}

      {deleteMember && (
        <div className="modal-backdrop" onMouseDown={() => saving !== deleteMember.id && setDeleteMember(null)}>
          <section
            className="modal session-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" disabled={saving === deleteMember.id} onClick={() => setDeleteMember(null)} aria-label="Cerrar">×</button>
            <div className="modal-icon danger">!</div>
            <h2 id="team-delete-title">Eliminar la cuenta de {deleteMember.name}</h2>
            <p>
              Esta acción es definitiva: borra la cuenta, sus sesiones y sus asignaciones.
              Si la persona creó eventos, la plataforma pedirá desactivarla en su lugar
              para conservar la trazabilidad.
            </p>
            <div className="session-delete-actions">
              <button className="session-cancel-button" disabled={saving === deleteMember.id} onClick={() => setDeleteMember(null)}>
                Conservar cuenta
              </button>
              <button className="session-confirm-delete" disabled={saving === deleteMember.id} onClick={() => void removeMember(deleteMember)}>
                {saving === deleteMember.id ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
