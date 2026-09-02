#!/usr/bin/env python3
"""Envío automático de comunicaciones: confirmación inmediata al registrarse,
recordatorios vencidos cancelados, planificador interno y cron externo.
Idempotente, por anclas. Los archivos propios se copian completos desde SRC."""
import os, shutil, sys

SRC = os.environ.get("SRC", "/tmp/d/icazalive-feat-aws-ivs-s3")

def rw(path, fn):
    s = open(path, encoding="utf-8").read()
    t = fn(s)
    if t != s:
        open(path, "w", encoding="utf-8").write(t)
    return t

if os.path.isdir(SRC):
    for rel in ["lib/communication-worker.ts", "instrumentation.ts",
                "app/api/cron/communications/route.ts"]:
        os.makedirs(os.path.dirname(rel) or ".", exist_ok=True)
        shutil.copyfile(os.path.join(SRC, rel), rel)
        print("copiado", rel)

def queue_edit(s, label):
    """Recordatorios ya vencidos -> cancelados; disparo tras la transacción."""
    if "isStaleDelivery" not in s:
        s = s.replace('import { getPublicOrigin } from "@/lib/public-origin";\n',
                      'import { getPublicOrigin } from "@/lib/public-origin";\nimport { isStaleDelivery, triggerDeliveries } from "@/lib/communication-worker";\n', 1)
        if "isStaleDelivery" not in s:
            print("FALLO", label, ": import public-origin"); sys.exit(1)
    old_a = '''          ? ("queued" as const)
          : ("scheduled" as const);'''
    new_a = '''          ? isStaleDelivery(message.type, scheduledFor, now)
            ? ("cancelled" as const)
            : ("queued" as const)
          : ("scheduled" as const);'''
    old_b = old_a.replace("          ", "            ")
    new_b = new_a.replace("\n          ", "\n            ").replace("          ?", "            ?", 1)
    if "isStaleDelivery(message.type" not in s:
        if old_a in s: s = s.replace(old_a, new_a, 1)
        elif old_b in s: s = s.replace(old_b, new_b, 1)
        else: print("FALLO", label, ": ancla status"); sys.exit(1)
    return s

def register(s):
    s = queue_edit(s, "register")
    if 'from "next/server"' in s and "after" not in s.split('from "next/server"')[0].rsplit("import",1)[1]:
        s = s.replace('import { NextResponse } from "next/server";', 'import { NextResponse, after } from "next/server";', 1)
    if "includeManagementFooter" not in s:
        s = s.replace('''      const renderedBody = renderParticipantCommunication({
        template: message.body,
        ...renderingInput,
      }).body;''', '''      const renderedBody = renderParticipantCommunication({
        template: message.body,
        includeManagementFooter:
          message.type === "registration_confirmation",
        ...renderingInput,
      }).body;''', 1)
    if "triggerDeliveries(event.id)" not in s:
        old = '''  await writeAuditLog({
    actorEmail: email,
    action: "privacy.consent.recorded",'''
        if old not in s: print("FALLO register: ancla audit"); sys.exit(1)
        s = s.replace(old, '''  // La confirmación sale en cuanto se responde al asistente.
  after(() => triggerDeliveries(event.id));

''' + old, 1)
    print("OK register/route.ts")
    return s

def invite(s):
    s = queue_edit(s, "invite")
    if "after" not in s.split('from "next/server"')[0].rsplit("import", 1)[1]:
        s = s.replace('import { NextResponse } from "next/server";', 'import { NextResponse, after } from "next/server";', 1)
    if "triggerDeliveries(event.id)" not in s:
        # Tras la transacción principal: primer "await writeAuditLog" fuera de ella.
        idx = s.find("\n  await writeAuditLog(")
        if idx < 0:
            idx = s.find("\n  return NextResponse.json(\n    {\n      data:")
        if idx < 0: print("FALLO invite: ancla post-transacción"); sys.exit(1)
        s = s[:idx] + "\n  after(() => triggerDeliveries(event.id));\n" + s[idx:]
    print("OK invite/route.ts")
    return s

def form(s):
    old = "Tu confirmación quedó registrada en la cola local. Conserva tu enlace individual para ingresar al lobby y participar durante el evento."
    new = "Te enviamos un correo de confirmación con tu enlace personal de acceso y te recordaremos antes de que comience. Conserva ese enlace para entrar a la sala."
    if old in s:
        s = s.replace(old, new, 1); print("OK registration-form.tsx")
    return s

rw("app/api/public/events/[slug]/register/route.ts", register)
rw("app/api/participants/invite/route.ts", invite)
rw("app/register/[slug]/registration-form.tsx", form)
print("LISTO")
