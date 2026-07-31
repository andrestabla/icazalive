"use client";

import { useEffect, useState } from "react";

type CatalogModule = {
  module: string;
  label: string;
  path: string;
  permissions: { key: string; label: string }[];
};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: "administrator" | "organizer";
  active: boolean;
  overrides: { permission: string; allowed: boolean }[];
};

type PermissionsData = {
  catalog: CatalogModule[];
  lockedForAdministrator: string[];
  roleDefaults: { administrator: string[]; organizer: string[] };
  users: StaffMember[];
};

const roleLabels = {
  administrator: "Administrador",
  organizer: "Organizador",
} as const;

export default function PermissionsManager() {
  const [data, setData] = useState<PermissionsData | null>(null);
  const [tab, setTab] = useState<"roles" | "users">("roles");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/permissions")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: PermissionsData } | null) => {
        if (cancelled || !payload?.data) return;
        setData(payload.data);
        setSelectedUserId((current) => current || payload.data!.users[0]?.id || "");
      })
      .catch(() => setError("No fue posible cargar los permisos."));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const update = async (body: Record<string, unknown>, message: string) => {
    setSaving(true);
    setNotice("");
    setError("");
    const response = await fetch("/api/permissions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (response.ok) {
      setNotice(message);
      setRefreshKey((current) => current + 1);
    } else {
      setError(payload.error ?? "No fue posible guardar el cambio.");
    }
  };

  if (!data) {
    return (
      <section className="panel analytics-state" aria-live="polite">
        <span className="analytics-loader" />
        <h2>Cargando permisos…</h2>
        <p>{error || "Consultando la configuración de accesos."}</p>
      </section>
    );
  }

  const selectedUser = data.users.find((member) => member.id === selectedUserId);
  const overrideFor = (permission: string) =>
    selectedUser?.overrides.find((item) => item.permission === permission);
  const roleHas = (role: "administrator" | "organizer", permission: string) =>
    data.roleDefaults[role].includes(permission);

  return (
    <>
      <header className="module-header">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Permisos</h1>
          <p>
            Define qué módulos y acciones tiene cada rol y ajusta excepciones por
            persona. Los módulos sin permiso no aparecen en la navegación.
          </p>
        </div>
      </header>

      {notice && <div className="detail-message" role="status">{notice}</div>}
      {error && <div className="participant-error" role="alert">ⓘ {error}</div>}

      <nav className="detail-tabs" aria-label="Ámbito de permisos">
        <button className={tab === "roles" ? "active" : ""} onClick={() => setTab("roles")}>
          Por rol (valores por defecto)
        </button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Por usuario (excepciones)
        </button>
      </nav>

      {tab === "roles" ? (
        <section className="panel permissions-panel">
          <div className="panel-heading">
            <div>
              <h2>Permisos por rol</h2>
              <p>Se aplican a todas las cuentas del rol salvo que tengan una excepción.</p>
            </div>
          </div>
          <div className="permissions-table">
            <div className="permissions-head">
              <span>Módulo y acción</span>
              <span>Administrador</span>
              <span>Organizador</span>
            </div>
            {data.catalog.map((module) => (
              <div className="permissions-group" key={module.module}>
                <p className="permissions-module">{module.label}</p>
                {module.permissions.map((permission) => {
                  const locked = data.lockedForAdministrator.includes(permission.key);
                  return (
                    <div className="permissions-row" key={permission.key}>
                      <span>{permission.label}</span>
                      <label className="permission-toggle">
                        <input
                          type="checkbox"
                          checked={roleHas("administrator", permission.key)}
                          disabled={saving || locked}
                          title={locked ? "Obligatorio para el rol administrador" : undefined}
                          onChange={(input) =>
                            void update(
                              {
                                scope: "role",
                                role: "administrator",
                                permission: permission.key,
                                allowed: input.target.checked,
                              },
                              `Permiso actualizado para el rol administrador.`,
                            )
                          }
                        />
                        <span>{locked ? "Obligatorio" : roleHas("administrator", permission.key) ? "Permitido" : "Bloqueado"}</span>
                      </label>
                      <label className="permission-toggle">
                        <input
                          type="checkbox"
                          checked={roleHas("organizer", permission.key)}
                          disabled={saving}
                          onChange={(input) =>
                            void update(
                              {
                                scope: "role",
                                role: "organizer",
                                permission: permission.key,
                                allowed: input.target.checked,
                              },
                              `Permiso actualizado para el rol organizador.`,
                            )
                          }
                        />
                        <span>{roleHas("organizer", permission.key) ? "Permitido" : "Bloqueado"}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel permissions-panel">
          <div className="panel-heading">
            <div>
              <h2>Excepciones por usuario</h2>
              <p>Cada permiso puede heredar del rol o forzarse para esta persona.</p>
            </div>
            <label className="filter-select">
              <span>Cuenta</span>
              <select
                value={selectedUserId}
                onChange={(input) => setSelectedUserId(input.target.value)}
              >
                {data.users.map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.name} · {roleLabels[member.role]}
                    {member.active ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedUser && (
            <div className="permissions-table">
              <div className="permissions-head user">
                <span>Módulo y acción</span>
                <span>Según su rol</span>
                <span>Para esta persona</span>
              </div>
              {data.catalog.map((module) => (
                <div className="permissions-group" key={module.module}>
                  <p className="permissions-module">{module.label}</p>
                  {module.permissions.map((permission) => {
                    const inherited = roleHas(selectedUser.role, permission.key);
                    const override = overrideFor(permission.key);
                    const current =
                      override === undefined ? "inherit" : override.allowed ? "allow" : "deny";
                    return (
                      <div className="permissions-row user" key={permission.key}>
                        <span>{permission.label}</span>
                        <i className={inherited ? "yes" : "no"}>
                          {inherited ? "Permitido" : "Bloqueado"}
                        </i>
                        <select
                          value={current}
                          disabled={saving}
                          aria-label={`${permission.label} para ${selectedUser.name}`}
                          onChange={(input) => {
                            const value = input.target.value;
                            void update(
                              {
                                scope: "user",
                                userId: selectedUser.id,
                                permission: permission.key,
                                allowed:
                                  value === "inherit" ? undefined : value === "allow",
                              },
                              `Permiso de ${selectedUser.name} actualizado.`,
                            );
                          }}
                        >
                          <option value="inherit">Heredar del rol</option>
                          <option value="allow">Permitir siempre</option>
                          <option value="deny">Bloquear siempre</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
