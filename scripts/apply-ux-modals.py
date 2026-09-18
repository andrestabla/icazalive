#!/usr/bin/env python3
"""UX (sept 2026):
1. Modal común de confirmación/error tras guardar (FeedbackDialog) en todos los
   paneles del equipo.
2. Texto de presentación de la página de registro editable (events.description).
3. Formularios de alta/edición en modales: campo nuevo del formulario, edición
   de campos base, nuevo recurso.
Archivos nuevos (se copian): lib/feedback.ts, app/components/feedback-dialog.tsx.
Anclado e idempotente."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

def read(rel): return (root / rel).read_text(encoding="utf-8")
def write(rel, s): (root / rel).write_text(s, encoding="utf-8")

def patch(rel, pairs, marker):
    s = read(rel)
    if marker in s: print(f"OK {rel}: ya aplicado"); return
    for old, new in pairs:
        if old not in s: print(f"ERROR {rel}: ancla no encontrada -> {old[:70]!r}"); sys.exit(1)
        s = s.replace(old, new, 1)
    write(rel, s); print(f"OK {rel}: aplicado")

def add_import(s, line):
    if line in s: return s
    last = max(m.end() for m in re.finditer(r'^import [^\n]*;\n', s, flags=re.M))
    return s[:last] + line + "\n" + s[last:]

# ---------------------------------------------------------------------------
# 1. Modal de confirmación / error
# ---------------------------------------------------------------------------
patch("app/layout.tsx", [
    ('import HelpWidget from "@/app/components/help-widget";',
     'import HelpWidget from "@/app/components/help-widget";\nimport FeedbackDialog from "@/app/components/feedback-dialog";'),
    ('''        <HelpWidget
          supportEmail={supportEmail}
          supportHours={supportHours}
        />''', '''        <HelpWidget
          supportEmail={supportEmail}
          supportHours={supportHours}
        />
        <FeedbackDialog />'''),
], "FeedbackDialog")

FEEDBACK_IMPORT = 'import { useFeedbackSetter } from "@/lib/feedback";'
# (archivo, nombre de estado, tipo de aviso) — el setter se envuelve para anunciar el modal.
SETTERS = [
    ("app/events/[slug]/event-detail.tsx", "message", None),
    ("app/participants/participants-list.tsx", "message", None),
    ("app/participants/participants-list.tsx", "error", "error"),
    ("app/participants/participant-inviter.tsx", "error", "error"),
    ("app/events/[slug]/registration-fields-manager.tsx", "error", "error"),
    ("app/events/[slug]/registration-fields-manager.tsx", "notice", None),
    ("app/events/[slug]/room-modules-panel.tsx", "notice", None),
    ("app/events/[slug]/registration-background-panel.tsx", "notice", None),
    ("app/team/team-manager.tsx", "message", None),
    ("app/team/team-manager.tsx", "error", "error"),
    ("app/brand/brand-editor.tsx", "message", None),
    ("app/brand/brand-editor.tsx", "error", "error"),
    ("app/permissions/permissions-manager.tsx", "notice", None),
    ("app/permissions/permissions-manager.tsx", "error", "error"),
    ("app/integrations/integrations-client.tsx", "message", None),
    ("app/privacy/manage/privacy-manager.tsx", "message", None),
    ("app/privacy/manage/privacy-manager.tsx", "error", "error"),
    ("app/events/[slug]/studio/studio-client.tsx", "message", None),
    ("app/events/[slug]/studio/studio-technical-test.tsx", "notice", None),
    ("app/events/[slug]/organizers-panel.tsx", "notice", None),
    ("app/events/[slug]/event-date-editor.tsx", "error", "error"),
    ("app/events/[slug]/zoom-livestream-panel.tsx", "notice", None),
    ("app/events/[slug]/simulated-content-panel.tsx", "status", None),
    ("app/events/[slug]/recorded-video-panel.tsx", "status", None),
    ("app/integrations/smtp-email-panel.tsx", "status", None),
    ("app/integrations/google-sso-panel.tsx", "status", None),
    ("app/content/content-library.tsx", "status", None),
    ("app/events/events-list.tsx", "notice", None),
]
STATE_RE = r'(  const \[{name}, )set{Name}(\] = useState(?:<[\s\S]*?>)?\([^\n]*?\);)'
touched = {}
for rel, name, kind in SETTERS:
    s = read(rel)
    Name = name[0].upper() + name[1:]
    if f"set{Name} = useFeedbackSetter(" in s:
        print(f"OK {rel}: {name} ya envuelto"); continue
    pattern = re.compile(STATE_RE.format(name=name, Name=Name))
    kind_arg = f', "{kind}"' if kind else ""
    new_s, n = pattern.subn(lambda m: f"{m.group(1)}set{Name}State{m.group(2)}\n  const set{Name} = useFeedbackSetter(set{Name}State{kind_arg});", s)
    if n == 0:
        print(f"ERROR {rel}: estado {name} no encontrado"); sys.exit(1)
    new_s = add_import(new_s, FEEDBACK_IMPORT)
    write(rel, new_s); touched[rel] = touched.get(rel, 0) + n
for rel, n in touched.items():
    print(f"OK {rel}: {n} setter(s) con modal de confirmación")

# ---------------------------------------------------------------------------
# 2. Texto de presentación editable (events.description)
# ---------------------------------------------------------------------------
route = "app/api/events/[slug]/route.ts"; s = read(route)
if "changes.description" not in s:
    s = s.replace("    feedbackQuestion?: string | null;\n", "    feedbackQuestion?: string | null;\n    description?: string | null;\n")
    old = '''  if (body.feedbackQuestion !== undefined) {
    changes.feedbackQuestion = body.feedbackQuestion?.trim() || null;
  }'''
    assert old in s, "events route: feedbackQuestion"
    s = s.replace(old, old + '''
  // Texto de presentación de la página de registro (y descripción al compartir).
  if (body.description !== undefined) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 400)) {
      return NextResponse.json({ error: "El texto de presentación admite hasta 400 caracteres." }, { status: 400 });
    }
    changes.description = body.description?.trim() || null;
  }''', 1)
    write(route, s); print(f"OK {route}: description editable")
else: print(f"OK {route}: ya aplicado")

ed = "app/events/[slug]/event-detail.tsx"; s = read(ed)
if "taglineOpen" not in s:
    s = s.replace('Partial<Pick<EventData, "status" |', 'Partial<Pick<EventData, "description" | "status" |', 1)
    anchor = "  const setMessage = useFeedbackSetter(setMessageState);"
    assert anchor in s, "event-detail: setMessage"
    s = s.replace(anchor, anchor + '''
  // Texto de presentación de la página de registro (modal de edición).
  const [taglineOpen, setTaglineOpen] = useState(false);
  const [taglineDraft, setTaglineDraft] = useState("");''', 1)
    anchor2 = "            <RegistrationBackgroundPanel slug={event.slug} />"
    assert anchor2 in s, "event-detail: background panel"
    s = s.replace(anchor2, '''            <div className="registration-tagline">
              <div>
                <p className="eyebrow">TEXTO DE PRESENTACIÓN</p>
                <p className="registration-tagline-text">{event.description?.trim() || "Una experiencia diseñada para aprender, conectar e interactuar."}</p>
                <small>Aparece bajo el título en la página de registro y como descripción al compartir el enlace.</small>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={saving}
                onClick={() => {
                  setTaglineDraft(event.description ?? "");
                  setTaglineOpen(true);
                }}
              >
                Editar
              </button>
            </div>
            {taglineOpen && (
              <div className="modal-backdrop" onMouseDown={() => setTaglineOpen(false)}>
                <section className="modal tagline-modal" role="dialog" aria-modal="true" aria-labelledby="tagline-title" onMouseDown={(click) => click.stopPropagation()}>
                  <button className="modal-close" onClick={() => setTaglineOpen(false)} aria-label="Cerrar">×</button>
                  <p className="eyebrow">PÁGINA DE REGISTRO</p>
                  <h2 id="tagline-title">Texto de presentación</h2>
                  <p>Una o dos frases que invitan a inscribirse. Si lo dejas vacío se usa el texto por defecto.</p>
                  <textarea
                    rows={3}
                    maxLength={400}
                    value={taglineDraft}
                    placeholder="Una experiencia diseñada para aprender, conectar e interactuar."
                    onChange={(input) => setTaglineDraft(input.target.value)}
                  />
                  <small className="tagline-counter">{taglineDraft.length}/400</small>
                  <div className="export-actions">
                    <button type="button" className="secondary-action" disabled={saving} onClick={() => setTaglineOpen(false)}>Cancelar</button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={saving}
                      onClick={() => void patchEvent({ description: taglineDraft.trim() || null }).then(() => setTaglineOpen(false))}
                    >
                      {saving ? "Guardando…" : "Guardar texto"}
                    </button>
                  </div>
                </section>
              </div>
            )}
''' + anchor2, 1)
    write(ed, s); print(f"OK {ed}: texto de presentación editable")
else: print(f"OK {ed}: texto de presentación ya aplicado")

# ---------------------------------------------------------------------------
# 3. Nuevo recurso en modal
# ---------------------------------------------------------------------------
s = read(ed)
if "resourceEditorOpen" not in s:
    anchor = "  const [taglineDraft, setTaglineDraft] = useState(\"\");"
    assert anchor in s, "event-detail: taglineDraft"
    s = s.replace(anchor, anchor + "\n  const [resourceEditorOpen, setResourceEditorOpen] = useState(false);", 1)
    old_head = '''                    <div><p className="eyebrow">RECURSOS</p><h2>Enlaces y archivos</h2>'''
    idx = s.index(old_head)
    end_head = s.index("</div>\n", idx) + len("</div>\n")
    head_block = s[idx:end_head]
    # Añade el botón de apertura al final de la cabecera del panel.
    new_head = head_block.rstrip("\n") + '''
                    <button type="button" className="secondary-action" onClick={() => setResourceEditorOpen(true)}>+ Agregar recurso</button>
'''
    s = s[:idx] + new_head + s[end_head:]
    old_open = '                  <div className="resource-creator-form">\n'
    assert old_open in s, "event-detail: resource-creator-form"
    s = s.replace(old_open, '''                  {resourceEditorOpen && (
                  <div className="modal-backdrop" onMouseDown={() => setResourceEditorOpen(false)}>
                  <section className="modal resource-modal" role="dialog" aria-modal="true" onMouseDown={(click) => click.stopPropagation()}>
                  <button className="modal-close" onClick={() => setResourceEditorOpen(false)} aria-label="Cerrar">×</button>
                  <p className="eyebrow">NUEVO RECURSO</p>
                  <h2>Agregar enlace o archivo</h2>
                  <div className="resource-creator-form">
''', 1)
    old_btn = '''                      onClick={() => void createResource()}
                    >
                      {interactionSaving === "new-resource" ? "Agregando…" : "Agregar recurso"}
                    </button>
                  </div>'''
    assert old_btn in s, "event-detail: botón agregar recurso"
    s = s.replace(old_btn, '''                      onClick={() => void createResource().then(() => setResourceEditorOpen(false))}
                    >
                      {interactionSaving === "new-resource" ? "Agregando…" : "Agregar recurso"}
                    </button>
                  </div>
                  </section>
                  </div>
                  )}''', 1)
    write(ed, s); print(f"OK {ed}: recurso en modal")
else: print(f"OK {ed}: recurso ya en modal")

# ---------------------------------------------------------------------------
# 4. Campos del formulario: alta en modal y edición de campos base en modal
# ---------------------------------------------------------------------------
rf = "app/events/[slug]/registration-fields-manager.tsx"; s = read(rf)
if "field-editor-modal" not in s:
    old_open = '''      {editorOpen && (
        <form className="registration-field-editor" onSubmit={createField}>'''
    assert old_open in s, "fields: editor open"
    s = s.replace(old_open, '''      {editorOpen && (
        <div className="modal-backdrop" onMouseDown={() => setEditorOpen(false)}>
        <section className="modal field-editor-modal" role="dialog" aria-modal="true" aria-labelledby="field-editor-title" onMouseDown={(click) => click.stopPropagation()}>
        <button className="modal-close" onClick={() => setEditorOpen(false)} aria-label="Cerrar">×</button>
        <p className="eyebrow">NUEVO CAMPO</p>
        <h2 id="field-editor-title">Agregar campo al formulario</h2>
        <form className="registration-field-editor" onSubmit={createField}>''', 1)
    old_close = '''            {saving === "new" ? "Agregando…" : "Agregar al formulario"}
          </button>
        </form>
      )}'''
    assert old_close in s, "fields: editor close"
    s = s.replace(old_close, '''            {saving === "new" ? "Agregando…" : "Agregar al formulario"}
          </button>
        </form>
        </section>
        </div>
      )}''', 1)
    # Campos base: etiqueta como texto + botón Editar que abre un modal
    old_input_start = s.index('              <input\n                type="text"\n                aria-label={`Etiqueta del campo ${DEFAULT_BASE_FIELDS[key].label}`}')
    old_input_end = s.index("              />\n", old_input_start) + len("              />\n")
    s = s[:old_input_start] + "              <b>{field.label}</b>\n" + s[old_input_end:]
    old_actions = '''              <span className="base-field-actions">
                <button type="button" disabled={busy || !field.active} onClick={() => void patchBaseField(key, { required: !field.required })}>'''
    assert old_actions in s, "fields: base actions"
    s = s.replace(old_actions, '''              <span className="base-field-actions">
                <button type="button" disabled={busy || !field.active} onClick={() => { setBaseDraft({ key, label: field.label, required: field.required }); }}>
                  Editar
                </button>
                <button type="button" disabled={busy || !field.active} onClick={() => void patchBaseField(key, { required: !field.required })}>''', 1)
    # Estado y modal de edición del campo base
    anchor_state = "  const [editorOpen, setEditorOpen] = useState(false);"
    assert anchor_state in s, "fields: editorOpen state"
    s = s.replace(anchor_state, anchor_state + '''
  // Edición de un campo base (etiqueta y obligatoriedad) en modal.
  const [baseDraft, setBaseDraft] = useState<{ key: BaseFieldKey; label: string; required: boolean } | null>(null);''', 1)
    anchor_modal = '      <div className="registration-base-fields editable">'
    assert anchor_modal in s, "fields: base grid"
    s = s.replace(anchor_modal, '''      {baseDraft && (
        <div className="modal-backdrop" onMouseDown={() => setBaseDraft(null)}>
          <section className="modal field-editor-modal" role="dialog" aria-modal="true" aria-labelledby="base-field-title" onMouseDown={(click) => click.stopPropagation()}>
            <button className="modal-close" onClick={() => setBaseDraft(null)} aria-label="Cerrar">×</button>
            <p className="eyebrow">CAMPO DEL FORMULARIO</p>
            <h2 id="base-field-title">Editar “{DEFAULT_BASE_FIELDS[baseDraft.key].label}”</h2>
            <label className="registration-editor-wide">
              Etiqueta que verá el asistente
              <input
                type="text"
                value={baseDraft.label}
                minLength={2}
                maxLength={60}
                onChange={(input) => setBaseDraft((current) => (current ? { ...current, label: input.target.value } : current))}
              />
            </label>
            <label className="registration-required-toggle">
              <input
                type="checkbox"
                checked={baseDraft.required}
                onChange={(input) => setBaseDraft((current) => (current ? { ...current, required: input.target.checked } : current))}
              />
              Solicitar respuesta obligatoria
            </label>
            <div className="export-actions">
              <button type="button" className="secondary-action" onClick={() => setBaseDraft(null)}>Cancelar</button>
              <button
                type="button"
                className="primary-button"
                disabled={saving !== "" || baseDraft.label.trim().length < 2}
                onClick={() => {
                  const draft = baseDraft;
                  void patchBaseField(draft.key, { label: draft.label.trim(), required: draft.required }).then(() => setBaseDraft(null));
                }}
              >
                Guardar cambios
              </button>
            </div>
          </section>
        </div>
      )}
''' + anchor_modal, 1)
    write(rf, s); print(f"OK {rf}: alta y edición en modales")
else: print(f"OK {rf}: ya en modales")

# ---------------------------------------------------------------------------
# 5. Estilos
# ---------------------------------------------------------------------------
css = root / "app/globals.css"; g = css.read_text(encoding="utf-8")
if ".feedback-dialog" not in g:
    g = g.rstrip("\n") + """

/* Modal de confirmación / error tras guardar. */
.feedback-backdrop { z-index: 60; }
.feedback-dialog { width: min(420px, 100%); display: grid; grid-template-columns: 44px 1fr; gap: 14px 16px; align-items: start; padding: 22px 24px 20px; }
.feedback-dialog .feedback-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; font-size: 20px; font-weight: 800; }
.feedback-dialog.success .feedback-icon { background: #e6f4ec; color: #1f6b45; }
.feedback-dialog.error .feedback-icon { background: #fdecec; color: #a3242b; }
.feedback-dialog .eyebrow { margin: 4px 0 4px; }
.feedback-dialog.error .eyebrow { color: #a3242b !important; }
.feedback-dialog.success .eyebrow { color: #1f6b45 !important; }
.feedback-text { margin: 0; font-size: 14px; line-height: 1.5; color: #3d3846; }
.feedback-dialog > button { grid-column: 2; justify-self: end; margin-top: 4px; }

/* Texto de presentación de la página de registro. */
.registration-tagline { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 16px 0; padding: 14px 16px; border: 1px solid #e6e2ec; border-radius: 11px; background: #faf9fc; }
.registration-tagline-text { margin: 4px 0 6px; font-size: 15px; line-height: 1.5; color: #221c30; }
.registration-tagline small { color: #8e8998; font-size: 12px; }
.tagline-modal textarea { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 10px 12px; border: 1px solid #d9d5e0; border-radius: 9px; font: inherit; font-size: 14px; resize: vertical; }
.tagline-counter { display: block; text-align: right; color: #9b96a4; font-size: 11px; margin: 6px 0 12px; }

/* Formularios de alta/edición en modal. */
.field-editor-modal, .resource-modal { width: min(640px, 100%); max-height: calc(100vh - 40px); overflow-y: auto; }
.field-editor-modal .registration-field-editor { margin: 14px 0 0; padding: 0; border: 0; background: transparent; }
.resource-modal .resource-creator-form { margin: 14px 0 0; padding: 0; border: 0; background: transparent; }
.base-field-card > b { display: block; font-size: 14px; margin: 6px 0 4px; }
"""
    css.write_text(g, encoding="utf-8"); print("OK globals.css: estilos UX")
else: print("OK globals.css: estilos ya presentes")
print("LISTO ux modales")
