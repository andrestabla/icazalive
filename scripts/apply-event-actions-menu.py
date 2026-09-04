#!/usr/bin/env python3
"""Sustituye los botones sueltos de cada evento por un menú "Acciones"
(Duplicar, Eliminar, Gestionar) y corrige el aviso de eliminación.
Se ejecuta después de apply-event-delete.py."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/events/events-list.tsx"
s = p.read_text()
if "event-actions-trigger" in s:
    print("ya aplicado"); sys.exit(0)

def sub(pattern, repl):
    global s
    new, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", pattern[:70]); sys.exit(1)
    s = new

# 1) Hoja de estilos propia
sub(r'(import type \{ FormEvent \} from "react";\n)', r'\1import "./events-actions.css";\n')

# 2) Estado del menú y cierre automático
STATE = r'''\1  const [actionsMenu, setActionsMenu] = useState<{
    event: EventRecord;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!actionsMenu) return;
    const close = () => setActionsMenu(null);
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [actionsMenu]);
'''
sub(r'(  const \[deleteNotice, setDeleteNotice\] = useState\(""\);\n)', STATE)

# 3) Un único botón "Acciones" en la fila
TRIGGER = r'''<div className="catalog-actions">
                  <button
                    type="button"
                    className="event-actions-trigger"
                    aria-haspopup="menu"
                    aria-expanded={actionsMenu?.event.id === event.id}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      const bounds = clickEvent.currentTarget.getBoundingClientRect();
                      setActionsMenu((current) =>
                        current?.event.id === event.id
                          ? null
                          : { event, x: bounds.right, y: bounds.bottom + 6 },
                      );
                    }}
                  >
                    Acciones <span aria-hidden="true">▾</span>
                  </button>
                </div>'''
sub(r'<div className="catalog-actions">.*?</div>', lambda _m: TRIGGER)

# 4) Aviso de eliminación con la misma estructura que el aviso existente
sub(r'\{deleteNotice && \(\s*<div className="events-notice" role="status">.*?</div>\s*\)\}',
    lambda _m: '''{deleteNotice && (
        <div className="events-notice" role="status">
          <span>✓</span>
          <p>{deleteNotice}</p>
          <button aria-label="Cerrar aviso" onClick={() => setDeleteNotice("")}>×</button>
        </div>
      )}''')

# 5) El menú desplegable, una sola vez, al final del componente
MENU = r'''
      {actionsMenu && (
        <div
          className="event-actions-menu"
          role="menu"
          style={{ left: actionsMenu.x, top: actionsMenu.y }}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              openDuplicate(actionsMenu.event);
              setActionsMenu(null);
            }}
          >
            Duplicar
          </button>
          {isAdmin && (
            <>
              <div className="event-actions-separator" />
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setDeleteTarget(actionsMenu.event);
                  setDeleteConfirmation("");
                  setDeleteError("");
                  setActionsMenu(null);
                }}
              >
                Eliminar
              </button>
              <div className="event-actions-separator" />
            </>
          )}
          <Link role="menuitem" href={`/events/${actionsMenu.event.slug}`}>
            Gestionar →
          </Link>
        </div>
      )}\1'''
sub(r'(\n    </>\n  \);\n\}\s*$)', MENU)

p.write_text(s)
print("ok", p)
