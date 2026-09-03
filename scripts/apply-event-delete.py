#!/usr/bin/env python3
"""Botón Eliminar (solo administradores) con confirmación en la lista de eventos. Ediciones ancladas."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/events/events-list.tsx"
s = p.read_text()
if "deleteTarget" in s:
    print("ya aplicado"); sys.exit(0)

def sub(pattern, repl):
    global s
    new, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", pattern[:70]); sys.exit(1)
    s = new

STATE = r'''\1  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { role?: string } } | null) => {
        if (!cancelled) setIsAdmin(payload?.data?.role === "administrator");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const deleteEvent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const response = await fetch(`/api/events/${deleteTarget.slug}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setDeleteError(payload.error ?? "No fue posible eliminar el evento.");
      setDeleting(false);
      return;
    }
    setEvents((current) => current.filter((item) => item.id !== deleteTarget.id));
    setDeleteNotice(`Evento “${deleteTarget.title}” eliminado. Queda registrado en Auditoría.`);
    setDeleteTarget(null);
    setDeleteConfirmation("");
    setDeleting(false);
  };
'''
sub(r'(  const \[duplicateSaving, setDuplicateSaving\] = useState\(false\);\n)', STATE)

NOTICE = r'''
      {deleteNotice && (
        <div className="events-notice" role="status">
          <span>{deleteNotice}</span>
          <button type="button" onClick={() => setDeleteNotice("")}>Cerrar</button>
        </div>
      )}\1'''
sub(r'(\n\s*\{notice && \()', NOTICE)

BUTTON = r'''\1
                  {isAdmin && (
                    <button style={{ color: "#b33b50" }} onClick={() => { setDeleteTarget(event); setDeleteConfirmation(""); setDeleteError(""); }}>
                      Eliminar
                    </button>
                  )}'''
sub(r'(<button onClick=\{\(\) => openDuplicate\(event\)\}>(?:<AdminIcon[^>]*/>)?\s*Duplicar</button>)', BUTTON)

MODAL = r'''
      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal duplicate-event-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setDeleteTarget(null)}>×</button>
            <span className="modal-icon danger">×</span>
            <p className="eyebrow">ELIMINAR EVENTO</p>
            <h2 id="delete-title">Eliminar “{deleteTarget.title}”</h2>
            <p>
              Se borrarán de forma definitiva sus sesiones, inscripciones, comunicaciones,
              chat, preguntas, encuestas y recursos. Si tiene reunión de Zoom, se marcará
              como cancelada. La eliminación queda registrada en Auditoría.
            </p>
            <form
              className="event-form"
              onSubmit={(formEvent) => {
                formEvent.preventDefault();
                void deleteEvent();
              }}
            >
              <label>
                Escribe ELIMINAR para confirmar
                <input
                  required
                  autoComplete="off"
                  value={deleteConfirmation}
                  onChange={(input) => setDeleteConfirmation(input.target.value)}
                  placeholder="ELIMINAR"
                />
              </label>
              {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
              <div className="duplicate-modal-actions">
                <button type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button>
                <button className="primary-button" disabled={deleting || deleteConfirmation.trim().toUpperCase() !== "ELIMINAR"}>
                  {deleting ? "Eliminando…" : "Eliminar definitivamente"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}\1'''
sub(r'(\n    </>\n  \);\n\}\s*$)', MODAL)

head = s.split("export default")[0]
if not re.search(r'import \{[^}]*useEffect[^}]*\} from "react";', head):
    def add(m):
        names = sorted(set([x.strip() for x in m.group(1).split(",") if x.strip()] + ["useEffect"]))
        return 'import { ' + ", ".join(names) + ' } from "react";'
    sub(r'import \{ ([^}]*)\} from "react";', add)
p.write_text(s)
print("ok", p)
