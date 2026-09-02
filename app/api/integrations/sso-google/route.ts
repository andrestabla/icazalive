import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { googleSsoSettings } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/email-crypto";
import { readGoogleSso, ssoRedirectUri } from "@/lib/google-sso";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await requireApiUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  if (user.role !== "administrator") {
    return { error: NextResponse.json({ error: "Solo un administrador puede configurar el SSO." }, { status: 403 }) };
  }
  return { user };
}

function safeView(row: Awaited<ReturnType<typeof readGoogleSso>>, redirectUri: string) {
  return {
    enabled: row?.enabled ?? false,
    clientId: row?.clientId ?? null,
    hasSecret: Boolean(row?.clientSecretEncrypted),
    allowedDomain: row?.allowedDomain ?? null,
    autoProvision: row?.autoProvision ?? false,
    provisionRole: row?.provisionRole ?? "participant",
    redirectUri,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ data: safeView(await readGoogleSso(), ssoRedirectUri(request)) });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
    clientId?: string | null;
    clientSecret?: string | null;
    allowedDomain?: string | null;
    autoProvision?: boolean;
    provisionRole?: "participant" | "administrator" | "organizer";
  };
  const clean = (v: unknown, max = 400) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const existing = await readGoogleSso();
  const values = {
    id: "default",
    enabled: body.enabled ?? existing?.enabled ?? false,
    clientId: body.clientId !== undefined ? clean(body.clientId) : existing?.clientId ?? null,
    clientSecretEncrypted:
      typeof body.clientSecret === "string" && body.clientSecret.trim()
        ? encryptSecret(body.clientSecret.trim())
        : existing?.clientSecretEncrypted ?? null,
    allowedDomain:
      body.allowedDomain !== undefined ? clean(body.allowedDomain, 120) : existing?.allowedDomain ?? null,
    autoProvision: body.autoProvision ?? existing?.autoProvision ?? false,
    provisionRole:
      body.provisionRole === "administrator" ||
      body.provisionRole === "organizer" ||
      body.provisionRole === "participant"
        ? body.provisionRole
        : existing?.provisionRole ?? "participant",
    updatedBy: auth.user.id,
    updatedAt: new Date(),
  } as const;

  const db = getDb();
  const [saved] = await db
    .insert(googleSsoSettings)
    .values(values)
    .onConflictDoUpdate({ target: googleSsoSettings.id, set: values })
    .returning();

  await writeAuditLog({
    actor: auth.user,
    action: "sso.google.configured",
    resourceType: "sso",
    resourceId: "google",
    summary: `SSO con Google ${saved.enabled ? "habilitado" : "actualizado"}.`,
    details: { enabled: saved.enabled, allowedDomain: saved.allowedDomain, autoProvision: saved.autoProvision },
    request,
  });
  return NextResponse.json({ data: safeView(saved, ssoRedirectUri(request)) });
}
