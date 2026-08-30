import Link from "next/link";
import AccountSecurity from "@/app/components/account-security";
import type { AuthenticatedUser } from "@/lib/auth";

export type SidebarSection =
  | "Resumen"
  | "Eventos"
  | "Participantes"
  | "Analítica"
  | "Contenidos"
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
  icon: string;
  permission: string;
}[] = [
  { label: "Resumen", href: "/", icon: "⌂", permission: "dashboard.view" },
  { label: "Eventos", href: "/events", icon: "◫", permission: "events.view" },
  { label: "Participantes", href: "/participants", icon: "♙", permission: "participants.view" },
  { label: "Analítica", href: "/analytics", icon: "⌁", permission: "analytics.view" },
];

const settingsModules: {
  label: SidebarSection;
  href: string;
  icon: string;
  permission: string;
}[] = [
  { label: "Contenidos", href: "/content", icon: "▤", permission: "content.view" },
  { label: "Integraciones", href: "/integrations", icon: "⌘", permission: "integrations.view" },
  { label: "Marca", href: "/brand", icon: "◇", permission: "brand.view" },
  { label: "Equipo", href: "/team", icon: "♧", permission: "team.view" },
  { label: "Permisos", href: "/permissions", icon: "⚿", permission: "permissions.manage" },
  { label: "Auditoría", href: "/audit", icon: "≋", permission: "audit.view" },
  { label: "Privacidad", href: "/privacy/manage", icon: "§", permission: "privacy.view" },
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
        <div className="brand-mark">I</div>
        <span>Icaza Live</span>
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
                <span>{item.icon}</span>
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
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="sidebar-bottom">
        <Link href="/help" className="help-card help-card-link">
          <span className="help-icon">?</span>
          <div><b>Centro de ayuda</b><small>Guías y soporte</small></div>
        </Link>
        <div className="profile">
          <div className="avatar">{initials}</div>
          <div><b>{user.name}</b><small>{roleLabels[user.role]}</small></div>
          <AccountSecurity />
          <form action="/api/auth/logout" method="post">
            <button aria-label="Cerrar sesión" title="Cerrar sesión">↪</button>
          </form>
        </div>
      </div>
    </aside>
  );
}
