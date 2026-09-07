import Link from "next/link";
import "./public-home.css";

// Portada pública del dominio. La ven los visitantes sin sesión (incluidos los
// revisores de proveedores de correo): explica qué es la plataforma, qué
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
        <div className="site-home-hero-inner">
          <div className="site-home-hero-copy">
            <p className="site-home-eyebrow">Plataforma de eventos corporativos</p>
            <h1>
              Eventos en vivo, híbridos<br />y simulados, en un solo lugar.
            </h1>
            <p className="site-home-lead">
              Icaza Jammoul Live es la plataforma con la que Icaza Jammoul organiza y
              transmite sus eventos corporativos: registro de asistentes, sala de
              transmisión con interacción en vivo y analítica de participación.
            </p>
            <dl className="site-home-facts">
              <div>
                <dt>Hasta 5.000</dt>
                <dd>asistentes por evento</dd>
              </div>
              <div>
                <dt>Zoom + Amazon IVS</dt>
                <dd>transmisión de baja latencia</dd>
              </div>
              <div>
                <dt>Chat y encuestas</dt>
                <dd>interacción en tiempo real</dd>
              </div>
            </dl>
          </div>

          <div className="site-home-visual" aria-hidden="true">
            <div className="mock-room">
              <div className="mock-room-bar">
                <span className="mock-live">EN VIVO</span>
                <span className="mock-count">1.248 asistentes</span>
              </div>
              <div className="mock-stage">
                <span className="mock-play" />
              </div>
              <div className="mock-panel">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="mock-mail">
              <b>Tu registro está confirmado</b>
              <span>Entrar al evento →</span>
            </div>
          </div>
        </div>
      </section>

      <section className="site-home-section">
        <p className="site-home-kicker">Formatos</p>
        <h2>Tres maneras de reunir a tu audiencia</h2>
        <div className="site-home-formats">
          <article>
            <span className="site-home-dot live" />
            <b>En vivo</b>
            <p>
              Transmisión en directo desde Zoom hacia la sala del evento, con
              interacción y moderación durante toda la sesión.
            </p>
          </article>
          <article>
            <span className="site-home-dot hybrid" />
            <b>Híbrido</b>
            <p>
              Comienza en directo y, en el minuto que definas, cede el paso al
              contenido preparado sin interrumpir la experiencia.
            </p>
          </article>
          <article>
            <span className="site-home-dot simulated" />
            <b>Simulado</b>
            <p>
              Contenido grabado que se emite a la hora programada como si fuera en
              vivo, con la misma sala y la misma interacción.
            </p>
          </article>
        </div>
      </section>

      <section className="site-home-section">
        <p className="site-home-kicker">Cómo funciona</p>
        <h2>Del registro a la sala, en cuatro pasos</h2>
        <ol className="site-home-steps">
          <li>
            <span>1</span>
            <b>La persona se inscribe</b>
            <p>
              Cada asistente se registra por su cuenta en el formulario del evento
              que le corresponde y acepta la política de privacidad y los términos
              de uso.
            </p>
          </li>
          <li>
            <span>2</span>
            <b>Recibe su confirmación</b>
            <p>
              Al terminar el registro enviamos un correo de confirmación con el
              enlace personal de acceso a la sala del evento.
            </p>
          </li>
          <li>
            <span>3</span>
            <b>Recordatorios del evento</b>
            <p>
              Antes de comenzar enviamos recordatorios programados y un aviso
              cuando la transmisión empieza.
            </p>
          </li>
          <li>
            <span>4</span>
            <b>Participa en la sala</b>
            <p>
              La sala reúne la transmisión, el chat, las preguntas al presentador,
              las encuestas y los recursos del evento.
            </p>
          </li>
        </ol>
      </section>

      <section className="site-home-mail-section">
        <div className="site-home-mail-inner">
          <div className="site-home-mail-head">
            <p className="site-home-kicker">Correo</p>
            <h2>Sobre los correos que enviamos</h2>
            <p>
              Nuestra comunicación por correo es estrictamente transaccional y está
              siempre ligada a un evento en el que la persona se inscribió.
            </p>
          </div>
          <div className="site-home-mail-grid">
            <article>
              <b>Solo correo transaccional</b>
              <p>
                Confirmación de registro, recordatorios, aviso de inicio y
                seguimiento posterior. No enviamos campañas comerciales ni
                boletines.
              </p>
            </article>
            <article>
              <b>Siempre a quien se registró</b>
              <p>
                Escribimos solo a quienes se inscribieron por su cuenta en un
                evento. No compramos, alquilamos ni importamos listas de contactos.
              </p>
            </article>
            <article>
              <b>Baja en un clic</b>
              <p>
                Cada correo incluye un enlace para gestionar o cancelar la
                inscripción y dejar de recibir mensajes de ese evento.
              </p>
            </article>
            <article>
              <b>Remitente verificado</b>
              <p>
                Enviamos desde <b>eventos@liveicazajammoul.com</b>, con SPF y DKIM
                sobre el dominio liveicazajammoul.com.
              </p>
            </article>
          </div>
          <p className="site-home-mail-contact">
            ¿Consultas sobre nuestros envíos? Escribe a{" "}
            <a href="mailto:soporte@liveicazajammoul.com">
              soporte@liveicazajammoul.com
            </a>
          </p>
        </div>
      </section>

      <footer className="site-home-footer">
        <div>
          <img src="/icaza-live-logo.png" alt="" aria-hidden="true" />
          <span>© {new Date().getFullYear()} Icaza Jammoul · Plataforma privada</span>
        </div>
        <nav aria-label="Enlaces legales">
          <Link href="/privacy">Política de privacidad</Link>
          <Link href="/privacy">Términos de uso</Link>
          <a href="mailto:soporte@liveicazajammoul.com">Contacto</a>
          <Link href="/login">Acceso del equipo</Link>
        </nav>
      </footer>
    </main>
  );
}
