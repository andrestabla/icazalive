#!/usr/bin/env python3
"""Centro de ayuda, lote 3: mensaje de cierre, cerrar la sala y línea de tiempo
del contenido simulado en la sala técnica."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "lib/help-guides.ts"; s = p.read_text(encoding="utf-8")
if "Cerrar la sala" in s:
    print("OK help-guides.ts: lote 3 ya presente"); sys.exit(0)

old = '''        { image: img("interaccion-modulos"), caption: t("Interruptores de los módulos de la sala.", "Room module switches.", "Interrupteurs des modules de la salle.") },
      ),'''
new = old + '''
      step(
        t(
          "Debajo de los interruptores está el **Mensaje al finalizar el evento**. Cuando el evento se completa (a mano o solo, al terminar el contenido simulado), la sala se cierra: desaparecen el video, el chat y las reacciones, y los asistentes ven ese mensaje. Edítalo y pulsa **Guardar mensaje**; también está en la Sala técnica.",
          "Below the switches is the **Message when the event ends**. When the event is completed (manually or automatically when the simulated content ends), the room closes: video, chat and reactions disappear and attendees see that message. Edit it and click **Save message**; it is also available in the Technical room.",
          "Sous les interrupteurs se trouve le **Message à la fin de l’événement**. Quand l’événement est terminé (à la main ou automatiquement à la fin du contenu simulé), la salle se ferme : la vidéo, le chat et les réactions disparaissent et les participants voient ce message. Modifiez-le et cliquez sur **Enregistrer le message** ; il est aussi dans la Salle technique.",
        ),
      ),'''
if old not in s: print("ERROR ancla interacción"); sys.exit(1)
s = s.replace(old, new, 1); print("OK interacción: mensaje de cierre")

old2 = '''        { image: img("transmision-biblioteca"), caption: t("Selección del contenido de la biblioteca.", "Library content selection.", "Sélection du contenu de la bibliothèque.") },
      ),'''
new2 = old2 + '''
      step(
        t(
          "En la **Sala técnica** de un evento simulado o híbrido, mientras el contenido se emite, aparece una **línea de tiempo** con el minuto que va y la duración total (por ejemplo, 28:10 / 43:00) y cuánto falta. Cuando el evento está en vivo, el botón **Cerrar la sala** detiene la emisión, completa el evento y muestra a los asistentes el mensaje de cierre.",
          "In the **Technical room** of a simulated or hybrid event, while the content is being broadcast, a **timeline** shows the current minute and the total duration (for example, 28:10 / 43:00) and how much is left. When the event is live, the **Close the room** button stops the broadcast, completes the event and shows attendees the closing message.",
          "Dans la **Salle technique** d’un événement simulé ou hybride, pendant la diffusion du contenu, une **ligne de temps** indique la minute en cours et la durée totale (par exemple 28:10 / 43:00) et ce qu’il reste. Quand l’événement est en direct, le bouton **Fermer la salle** arrête la diffusion, termine l’événement et affiche le message de clôture aux participants.",
        ),
      ),'''
if old2 not in s: print("ERROR ancla transmisión"); sys.exit(1)
s = s.replace(old2, new2, 1); print("OK transmisión: línea de tiempo y cierre")
p.write_text(s, encoding="utf-8"); print("LISTO help-guides.ts lote 3")
