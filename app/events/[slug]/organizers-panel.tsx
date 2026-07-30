"use client";

import { useCallback, useEffect, useState } from "react";

type Organizer = {
  userId: string;
  role: "owner" | "co_organizer";
  name: string;
  email: string;
  active: boolean;
  assignedAt: string;
};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: "administrator" | "organizer";
};

export default function OrganizersPanel({ eventSlug }: { eventSlug: string }) {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/events/${eventSlug}/organizers`);
    if (!response.ok) return;
    const payload = (await response.json()) as {
      data?: {
        organizers: Organizer[];
        availableStaff: StaffMember[];
        canManage: boolean;
      };
    };
    if (payload.data) {
      setOrganizers(payload.data.organizers);
      setAvailableStaff(payload.data.availableStaff);
      setCanManage(payload.data.canManage);
    }
  }, [eventSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = async (
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, string>,
    successMessage: string,
  ) => {
    setSaving(true);
    setNotice("");
    const response = await fetch(`/api/events/${eventSlug}/organizers`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string };
    if (response.ok) {
      setNotice(successMessage);
      setSelectedUserId("");
      await refresh();
    } else {
      setNotice(payload.error ?? "La operación no fue posible.");
    }
    setSaving(false);
  };

  return (
    <section className="panel organizers-panel">
      <div className="panel-heading">
        <div>
          <h2>Organizadores</h2>
          <p>Propietario y coorganizadores del evento.</p>
        </div>
      </div>
      <div className="organizer-list">
        {organizers.map((organizer) => (
          <div className="organizer-row" key={organizer.userId}>
            <span className="avatar soft">
              {organizer.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </span>
            <div>
              <b>{organizer.name}</b>
              <small>{organizer.email}</small>
            </div>
            <i className={organizer.role}>
              {organizer.role === "owner" ? "Propietario" : "Coorganizador"}
            </i>
            {canManage && organizer.role === "co_organizer" && (
              <div className="organizer-actions">
                <button
                  disabled={saving}
                  title="Transferir la propiedad a esta persona"
                  onClick={() =>
                    void mutate(
                      "PATCH",
                      { action: "transfer_ownership", userId: organizer.userId },
                      `${organizer.name} ahora es propietario del evento.`,
                    )
                  }
                >
                  Hacer propietario
                </button>
                <button
                  disabled={saving}
                  title="Retirar del evento"
                  onClick={() =>
                    void mutate(
                      "DELETE",
                      { userId: organizer.userId },
                      `${organizer.name} fue retirado del evento.`,
                    )
                  }
                >
                  Retirar
                </button>
              </div>
            )}
          </div>
        ))}
        {!organizers.length && (
          <div className="organizer-empty">Cargando organizadores…</div>
        )}
      </div>
      {notice && <p className="organizer-notice" role="status">{notice}</p>}
      {canManage && availableStaff.length > 0 && (
        <div className="organizer-add">
          <select
            value={selectedUserId}
            disabled={saving}
            aria-label="Agregar coorganizador"
            onChange={(input) => setSelectedUserId(input.target.value)}
          >
            <option value="">Agregar coorganizador…</option>
            {availableStaff.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name} · {member.role === "administrator" ? "Admin" : "Organizador"}
              </option>
            ))}
          </select>
          <button
            disabled={saving || !selectedUserId}
            onClick={() => {
              const member = availableStaff.find((item) => item.id === selectedUserId);
              void mutate(
                "POST",
                { userId: selectedUserId },
                `${member?.name ?? "La persona"} fue asignada como coorganizadora.`,
              );
            }}
          >
            {saving ? "…" : "Agregar"}
          </button>
        </div>
      )}
    </section>
  );
}
