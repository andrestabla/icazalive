import Link from "next/link";
import AccountSecurity from "@/app/components/account-security";
import {
  AdminIcon,
  type AdminIconName,
} from "@/app/components/admin-icon";
import type { AuthenticatedUser } from "@/lib/auth";

export type SidebarSection =
  | "Resumen"
  | "Eventos"
  | "Participantes"
  | "Analítica"
  | "Integraciones"
  | "Marca"
  | "Equipo"
  | "Permisos"
  | "Auditoría"
  | "Privacidad";

// La navegación se arma con los permisos efectivos del usuario: solo se
// muestran los módulos a los que realmente puede entrar.
const workspaceModules: {
  label: SidebarSection;
  href: string;
  icon: AdminIconName;
  permission: string;
}[] = [
  { label: "Resumen", href: "/", icon: "overview", permission: "dashboard.view" },
  { label: "Eventos", href: "/events", icon: "events", permission: "events.view" },
  { label: "Participantes", href: "/participants", icon: "participants", permission: "participants.view" },
  { label: "Analítica", href: "/analytics", icon: "analytics", permission: "analytics.view" },
];

const settingsModules: {
  label: SidebarSection;
  href: string;
  icon: AdminIconName;
  permission: string;
}[] = [
  { label: "Integraciones", href: "/integrations", icon: "integrations", permission: "integrations.view" },
  { label: "Marca", href: "/brand", icon: "brand", permission: "brand.view" },
  { label: "Equipo", href: "/team", icon: "team", permission: "team.view" },
  { label: "Permisos", href: "/permissions", icon: "permissions", permission: "permissions.manage" },
  { label: "Auditoría", href: "/audit", icon: "audit", permission: "audit.view" },
  { label: "Privacidad", href: "/privacy/manage", icon: "privacy", permission: "privacy.view" },
];

export default function AdminSidebar({
  user,
  granted,
  active,
}: {
  user: AuthenticatedUser;
  granted: string[];
  active: SidebarSection;
}) {
  const allowed = new Set(granted);
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const roleLabels = {
    administrator: "Administrador",
    organizer: "Organizador",
    participant: "Participante",
  };

  const visibleWorkspace = workspaceModules.filter((item) =>
    allowed.has(item.permission),
  );
  const visibleSettings = settingsModules.filter((item) =>
    allowed.has(item.permission),
  );

  return (
    <aside className="sidebar">
      <Link href="/" className="brand brand-link">
        <img className="brand-logo" src="/icaza-live-logo.png" alt="Icaza Jammoul Live" />
      </Link>
      <nav aria-label="Navegación principal">
        {visibleWorkspace.length > 0 && (
          <>
            <p className="nav-label">ESPACIO DE TRABAJO</p>
            {visibleWorkspace.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active === item.label ? "active" : ""}`}
                aria-current={active === item.label ? "page" : undefined}
              >
                <span><AdminIcon name={item.icon} /></span>
                {item.label}
              </Link>
            ))}
          </>
        )}
        {visibleSettings.length > 0 && (
          <>
            <p className="nav-label second">CONFIGURACIÓN</p>
            {visibleSettings.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active === item.label ? "active" : ""}`}
                aria-current={active === item.label ? "page" : undefined}
              >
                <span><AdminIcon name={item.icon} /></span>
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="sidebar-bottom">
        <Link href="/help" className="help-card help-card-link">
          <span className="help-icon"><AdminIcon name="help" /></span>
          <div><b>Centro de ayuda</b><small>Guías y soporte</small></div>
        </Link>
        <div className="profile">
          <div className="avatar">{initials}</div>
          <div><b>{user.name}</b><small>{roleLabels[user.role]}</small></div>
          <AccountSecurity />
          <form action="/api/auth/logout" method="post">
            <button aria-label="Cerrar sesión" title="Cerrar sesión"><AdminIcon name="logout" /></button>
          </form>
        </div>
      </div>
    </aside>
  );
}
