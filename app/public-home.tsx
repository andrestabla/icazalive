import Link from "next/link";
import "./public-home.css";

// Portada pública del dominio. La ven los visitantes sin sesión (incluidos los
// revisores de proveedores como Amazon SES): explica qué es la plataforma, qué
// correos envía y cómo se cancela la suscripción, con acceso a los documentos
// legales y al contacto. El equipo entra por /login.
export default function PublicHome() {
  return (
    <main className="site-home">
      <header className="site-home-topbar">
        <img src="/icaza-live-logo.png" alt="Icaza Jammoul Live" />
        <Link href="/login" className="site-home-access">
          Acceso del equipo
        </Link>
      </header>

      <section className="site-home-hero">
        <div>
          <p className="site-home-eyebrow">PLATAFORMA DE EVENTOS CORPORATIVOS</p>
          <h1>
            Eventos en vivo, híbridos y simulados,
            <br />
            en un solo lugar.
          </h1>
          <p className="site-home-lead">
            Icaza Jammoul Live es la plataforma con la que Icaza Jammoul organiza y
            transmite sus eventos corporativos: registro de asistentes, sala de
            transmisión con interacción en vivo y analítica de participación.
          </p>
          <div className="site-home-facts">
            <div>
              <b>Hasta 5.000</b>
              <span>asistentes por evento</span>
            </div>
            <div>
              <b>En vivo e híbrido</b>
              <span>Zoom + Amazon IVS</span>
            </div>
            <div>
              <b>Interacción</b>
              <span>chat, preguntas y encuestas</span>
            </div>
          </div>
        </div>
      </section>

      <section className="site-home-section">
        <h2>Cómo funciona</h2>
        <ol className="site-home-steps">
          <li>
            <span>1</span>
            <div>
              <b>La persona se inscribe</b>
              <p>
                Cada asistente se registra por su cuenta en el formulario del evento
                que le corresponde y acepta la política de privacidad y los términos
                de uso.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <b>Recibe su confirmación</b>
              <p>
                Al terminar el registro enviamos un correo de confirmación con el
                enlace personal de acceso a la sala del evento.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <b>Recordatorios del evento</b>
              <p>
                Antes de comenzar enviamos recordatorios programados y un aviso
                cuando la transmisión empieza.
              </p>
            </div>
          </li>
          <li>
            <span>4</span>
            <div>
              <b>Participa en la sala</b>
              <p>
                La sala reúne la transmisión, el chat, las preguntas al presentador,
                las encuestas y los recursos del evento.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="site-home-section site-home-mail">
        <h2>Sobre los correos que enviamos</h2>
        <div className="site-home-mail-grid">
          <article>
            <b>Solo correo transaccional</b>
            <p>
              Enviamos únicamente mensajes ligados a un evento concreto:
              confirmación de registro, recordatorios, aviso de inicio y seguimiento
              posterior. No enviamos campañas comerciales ni boletines.
            </p>
          </article>
          <article>
            <b>Siempre a quien se registró</b>
            <p>
              Escribimos solo a las personas que se inscribieron por su cuenta en un
              evento. No compramos, alquilamos ni importamos listas de contactos.
            </p>
          </article>
          <article>
            <b>Baja en un clic</b>
            <p>
              Cada correo incluye un enlace para gestionar o cancelar la inscripción
              y dejar de recibir mensajes de ese evento.
            </p>
          </article>
          <article>
            <b>Remitente verificado</b>
            <p>
              Los correos salen de <b>eventos@liveicazajammoul.com</b>, con SPF y
              DKIM sobre el dominio liveicazajammoul.com. Para consultas escribe a{" "}
              <a href="mailto:soporte@liveicazajammoul.com">
                soporte@liveicazajammoul.com
              </a>
              .
            </p>
          </article>
        </div>
      </section>

      <footer className="site-home-footer">
        <span>© {new Date().getFullYear()} Icaza Jammoul · Plataforma privada</span>
        <nav>
          <Link href="/privacy">Política de privacidad</Link>
          <Link href="/privacy">Términos de uso</Link>
          <a href="mailto:soporte@liveicazajammoul.com">Contacto</a>
          <Link href="/login">Acceso del equipo</Link>
        </nav>
      </footer>
    </main>
  );
}
