import Link from "next/link";
import AccountSecurity from "@/app/components/account-security";
import type { AuthenticatedUser } from "@/lib/auth";

export default function AdminSidebar({
  user,
  active,
}: {
  user: AuthenticatedUser;
  active: "Resumen" | "Eventos" | "Participantes" | "Analítica" | "Integraciones" | "Marca" | "Equipo" | "Auditoría" | "Privacidad";
}) {
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

  return (
    <aside className="sidebar">
      <Link href="/" className="brand brand-link">
        <div className="brand-mark">I</div>
        <span>Icaza Live</span>
      </Link>
      <nav aria-label="Navegación principal">
        <p className="nav-label">ESPACIO DE TRABAJO</p>
        <Link href="/" className={`nav-item ${active === "Resumen" ? "active" : ""}`}><span>⌂</span>Resumen</Link>
        <Link href="/events" className={`nav-item ${active === "Eventos" ? "active" : ""}`}><span>◫</span>Eventos</Link>
        <Link href="/participants" className={`nav-item ${active === "Participantes" ? "active" : ""}`}><span>♙</span>Participantes</Link>
        <Link href="/analytics" className={`nav-item ${active === "Analítica" ? "active" : ""}`}><span>⌁</span>Analítica</Link>
        <p className="nav-label second">CONFIGURACIÓN</p>
        <Link href="/integrations" className={`nav-item ${active === "Integraciones" ? "active" : ""}`}><span>⌘</span>Integraciones</Link>
        <Link href="/brand" className={`nav-item ${active === "Marca" ? "active" : ""}`}><span>◇</span>Marca</Link>
        {user.role === "administrator" && <Link href="/team" className={`nav-item ${active === "Equipo" ? "active" : ""}`}><span>♧</span>Equipo</Link>}
        {user.role === "administrator" && <Link href="/audit" className={`nav-item ${active === "Auditoría" ? "active" : ""}`}><span>≋</span>Auditoría</Link>}
        {user.role === "administrator" && <Link href="/privacy/manage" className={`nav-item ${active === "Privacidad" ? "active" : ""}`}><span>§</span>Privacidad</Link>}
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
