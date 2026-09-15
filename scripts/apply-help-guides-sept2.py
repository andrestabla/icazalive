#!/usr/bin/env python3
"""Centro de ayuda, lote 2: momento del seguimiento posterior, botón Añadir al
calendario, estados automáticos de asistencia y eliminación de participantes."""
import sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "lib/help-guides.ts"; s = p.read_text(encoding="utf-8")
if "Guardar momento" in s:
    print("OK help-guides.ts: lote 2 ya presente"); sys.exit(0)

def rep(old, new, label):
    global s
    if old not in s: print("ERROR ancla no encontrada:", label); sys.exit(1)
    s = s.replace(old, new, 1); print("OK", label)

# Comunicaciones: momento del seguimiento + calendario (tras el paso de Calendly)
old = '''        { image: img("comunicaciones-agendar"), caption: t("Enlace de agendamiento del organizador.", "Organizer scheduling link.", "Lien de prise de rendez-vous de l’organisateur.") },
      ),'''
new = old + '''
      step(
        t(
          "En el mismo mensaje, el bloque **Momento de envío** define cuándo sale el seguimiento: escribe la cantidad, elige **minutos** u **horas** y pulsa **Guardar momento**. Se cuenta desde que **termina** el evento (por ejemplo, 2 horas después). Los envíos ya programados se mueven solos al nuevo momento.",
          "In the same message, the **Send time** block defines when the follow-up goes out: type the amount, choose **minutes** or **hours** and click **Save time**. It counts from the moment the event **ends** (for example, 2 hours later). Already scheduled deliveries move automatically to the new time.",
          "Dans le même message, le bloc **Moment d’envoi** définit quand part le suivi : saisissez la quantité, choisissez **minutes** ou **heures** et cliquez sur **Enregistrer le moment**. Il se compte à partir de la **fin** de l’événement (par exemple 2 heures après). Les envois déjà programmés se déplacent automatiquement.",
        ),
      ),
      step(
        t(
          "El botón **Añadir al calendario** de los correos abre una página con el evento ya cargado para **Google Calendar**, **Outlook.com**, **Outlook empresarial (Microsoft 365)**, **Yahoo Calendar** y un archivo **.ics** para Apple Calendar u Outlook de escritorio. El asistente elige su calendario y el evento queda guardado con su enlace personal de acceso.",
          "The **Add to calendar** button in the emails opens a page with the event preloaded for **Google Calendar**, **Outlook.com**, **Outlook for business (Microsoft 365)**, **Yahoo Calendar** and an **.ics** file for Apple Calendar or desktop Outlook. The attendee picks their calendar and the event is saved with their personal access link.",
          "Le bouton **Ajouter au calendrier** des e-mails ouvre une page avec l’événement préchargé pour **Google Calendar**, **Outlook.com**, **Outlook professionnel (Microsoft 365)**, **Yahoo Calendar** et un fichier **.ics** pour Apple Calendar ou Outlook de bureau. Le participant choisit son agenda et l’événement est enregistré avec son lien d’accès personnel.",
        ),
      ),'''
rep(old, new, "comunicaciones: momento y calendario")

# Participantes: estados automáticos y eliminación
old2 = '''    title: t("Invitar personas una a una", "Invite people one by one", "Inviter des personnes une par une"),'''
# insertamos un paso al final de la sección "lista" de participantes buscando su cierre: usamos el título de la sección de invitación como ancla y añadimos una sección previa
new2 = '''    title: t("Invitar personas una a una", "Invite people one by one", "Inviter des personnes une par une"),'''
rep(old2, new2, "participantes: ancla invitar")
sec = '''  {
    id: "estados-automaticos",
    title: t("Estados automáticos y eliminación", "Automatic statuses and deletion", "Statuts automatiques et suppression"),
    steps: [
      step(
        t(
          "Los estados cambian solos: al inscribirse la persona queda **Registrado** (o **Confirmado** si la invitaste tú); si cancela desde su enlace personal pasa a **Cancelado**; al entrar a la sala con su enlace mientras el evento está **En vivo** pasa a **Asistió**; y al completarse el evento, quien nunca entró queda como **No asistió**. Puedes corregir cualquier estado a mano desde **Ver historial**.",
          "Statuses change on their own: on sign-up the person is **Registered** (or **Confirmed** if you invited them); if they cancel from their personal link they become **Cancelled**; entering the room with their link while the event is **Live** marks them **Attended**; and when the event is completed, anyone who never entered becomes **No-show**. You can correct any status manually from **View history**.",
          "Les statuts changent automatiquement : à l’inscription la personne est **Inscrite** (ou **Confirmée** si vous l’avez invitée) ; si elle annule depuis son lien personnel elle devient **Annulée** ; entrer dans la salle avec son lien pendant que l’événement est **En direct** la marque **Présente** ; et à la clôture de l’événement, qui n’est jamais entré devient **Absent**. Vous pouvez corriger tout statut à la main depuis **Voir l’historique**.",
        ),
      ),
      step(
        t(
          "Solo un **administrador** ve el botón **Eliminar participante** dentro de **Ver historial**. Borra de forma definitiva sus inscripciones en todos los eventos, sus accesos y los correos pendientes; los registros de consentimiento se conservan sin datos personales, como exige la ley.",
          "Only an **administrator** sees the **Delete participant** button inside **View history**. It permanently removes their registrations in all events, their access links and pending emails; consent records are kept without personal data, as the law requires.",
          "Seul un **administrateur** voit le bouton **Supprimer le participant** dans **Voir l’historique**. Il supprime définitivement ses inscriptions à tous les événements, ses accès et les e-mails en attente ; les registres de consentement sont conservés sans données personnelles, comme l’exige la loi.",
        ),
        {
          warning: t(
            "La eliminación no se puede deshacer. Si solo quieres sacar a alguien de un evento, cambia su estado a Cancelado.",
            "Deletion cannot be undone. If you only want to remove someone from one event, set their status to Cancelled.",
            "La suppression est irréversible. Pour retirer quelqu’un d’un seul événement, passez son statut à Annulé.",
          ),
        },
      ),
    ],
  },
  {
'''
anchor = '''  {
    id: "invitar",'''
if anchor not in s: print("ERROR ancla sección invitar"); sys.exit(1)
s = s.replace(anchor, sec + '''    id: "invitar",''', 1); print("OK participantes: sección estados automáticos")
p.write_text(s, encoding="utf-8"); print("LISTO help-guides.ts lote 2")
