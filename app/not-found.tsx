import Link from "next/link";

export const metadata = { title: "Página no encontrada — Icaza Jammoul Live" };

export default function NotFound() {
  return (
    <main className="notfound-shell">
      <div className="notfound-card">
        <div className="brand-mark">I</div>
        <p className="eyebrow">ERROR 404</p>
        <h1>No encontramos esta página</h1>
        <p>
          El enlace puede haber cambiado, el evento fue eliminado o la dirección
          se escribió de otra forma.
        </p>
        <div className="notfound-actions">
          <Link className="primary-button link-button" href="/">Ir al resumen</Link>
          <Link className="notfound-secondary" href="/help">Centro de ayuda</Link>
        </div>
      </div>
    </main>
  );
}
