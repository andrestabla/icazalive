#!/usr/bin/env python3
"""Centro de ayuda: enviar mensaje a participantes seleccionados."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "lib/help-guides.ts"; s = p.read_text(encoding="utf-8")
if "Enviar mensaje" in s:
    print("OK help-guides.ts: envío manual ya presente"); sys.exit(0)
anchor = '''  {
    id: "estados-automaticos",'''
if anchor not in s: print("ERROR ancla estados-automaticos"); sys.exit(1)
section = '''  {
    id: "enviar-mensaje",
    title: t("Enviar un mensaje a varios participantes", "Send a message to several participants", "Envoyer un message à plusieurs participants"),
    steps: [
      step(
        t(
          "Marca las casillas de la lista (la casilla de la cabecera selecciona a todos los que coinciden con los filtros) y pulsa **✉ Enviar mensaje (n)**. Elige **Plantilla del evento** para reutilizar una de las comunicaciones configuradas (cada persona recibe la versión de su propio evento) o **Mensaje nuevo** para escribir asunto y texto con las mismas variables, por ejemplo `{{participant_name}}` o `{{access_link}}`.",
          "Tick the boxes in the list (the header box selects everyone matching the filters) and click **✉ Send message (n)**. Choose **Event template** to reuse one of the configured communications (each person gets their own event's version) or **New message** to write a subject and text with the same variables, for example `{{participant_name}}` or `{{access_link}}`.",
          "Cochez les cases de la liste (la case de l’en-tête sélectionne tous ceux qui correspondent aux filtres) et cliquez sur **✉ Envoyer un message (n)**. Choisissez **Modèle de l’événement** pour réutiliser une communication configurée (chacun reçoit la version de son propre événement) ou **Nouveau message** pour rédiger objet et texte avec les mêmes variables, par exemple `{{participant_name}}` ou `{{access_link}}`.",
        ),
        {
          tip: t(
            "Todos los correos salen con la cabecera y el pie de la marca y conservan el enlace personal de cada asistente. Los inscritos cancelados o inactivos se omiten. Cada envío queda registrado en Auditoría.",
            "Every email goes out with the brand header and footer and keeps each attendee's personal link. Cancelled or inactive registrants are skipped. Each send is recorded in Audit.",
            "Chaque e-mail part avec l’en-tête et le pied de page de la marque et conserve le lien personnel de chaque participant. Les inscrits annulés ou inactifs sont ignorés. Chaque envoi est enregistré dans Audit.",
          ),
        },
      ),
    ],
  },
'''
s = s.replace(anchor, section + anchor, 1)
p.write_text(s, encoding="utf-8"); print("OK help-guides.ts: envío manual")
