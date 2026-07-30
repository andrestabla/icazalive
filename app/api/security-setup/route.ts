import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { identitySettings } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import {
  evaluateIdentitySettings,
  type IdentityProtocol,
  type MfaMethod,
  type MfaPolicy,
} from "@/lib/identity-settings";

export const runtime = "nodejs";

const protocols: IdentityProtocol[] = ["oidc", "saml"];
const mfaPolicies: MfaPolicy[] = [
  "optional",
  "required_admins",
  "required_all",
];
const mfaMethods: MfaMethod[] = ["totp", "webauthn", "email"];

async function requireAdministrator() {
  const user = await requireApiUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (user.role !== "administrator") {
    return {
      error: NextResponse.json({ error: "No autorizado." }, { status: 403 }),
    };
  }
  return { user };
}

function cleanText(value: unknown, maxLength: number) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("invalid");
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) throw new Error("invalid");
  return cleaned;
}

function validHttpsOrLocalUrl(value: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

export async function GET() {
  const auth = await requireAdministrator();
  if ("error" in auth) return auth.error;

  const [record] = await getDb()
    .select()
    .from(identitySettings)
    .where(eq(identitySettings.id, "default"))
    .limit(1);
  if (!record) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      settings: record,
      evaluation: evaluateIdentitySettings(record),
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdministrator();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    action?: "save" | "check";
    providerName?: string | null;
    protocol?: IdentityProtocol;
    organizationDomain?: string | null;
    issuerUrl?: string | null;
    clientId?: string | null;
    entityId?: string | null;
    mfaPolicy?: MfaPolicy;
    mfaMethod?: MfaMethod;
    recoveryCodesRequired?: boolean;
  };

  if (
    (body.action !== undefined &&
      body.action !== "save" &&
      body.action !== "check") ||
    !body.protocol ||
    !protocols.includes(body.protocol) ||
    !body.mfaPolicy ||
    !mfaPolicies.includes(body.mfaPolicy) ||
    !body.mfaMethod ||
    !mfaMethods.includes(body.mfaMethod) ||
    typeof body.recoveryCodesRequired !== "boolean"
  ) {
    return NextResponse.json(
      { error: "La política de identidad no es válida." },
      { status: 400 },
    );
  }

  let providerName: string | null;
  let organizationDomain: string | null;
  let issuerUrl: string | null;
  let clientId: string | null;
  let entityId: string | null;
  try {
    providerName = cleanText(body.providerName, 120);
    organizationDomain = cleanText(body.organizationDomain, 253)?.toLowerCase() ?? null;
    issuerUrl = cleanText(body.issuerUrl, 500);
    clientId = cleanText(body.clientId, 500);
    entityId = cleanText(body.entityId, 500);
  } catch {
    return NextResponse.json(
      { error: "Revisa los datos del proveedor de identidad." },
      { status: 400 },
    );
  }

  if (
    organizationDomain &&
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      organizationDomain,
    )
  ) {
    return NextResponse.json(
      { error: "El dominio corporativo no tiene un formato válido." },
      { status: 400 },
    );
  }
  if (!validHttpsOrLocalUrl(issuerUrl)) {
    return NextResponse.json(
      { error: "La URL del proveedor debe usar HTTPS." },
      { status: 400 },
    );
  }

  const safeSettings = {
    providerName,
    protocol: body.protocol,
    organizationDomain,
    issuerUrl,
    clientId: body.protocol === "oidc" ? clientId : null,
    entityId: body.protocol === "saml" ? entityId : null,
    mfaPolicy: body.mfaPolicy,
    mfaMethod: body.mfaMethod,
    recoveryCodesRequired: body.recoveryCodesRequired,
  };
  const evaluation = evaluateIdentitySettings(safeSettings);
  const now = new Date();
  const [settings] = await getDb()
    .insert(identitySettings)
    .values({
      id: "default",
      ...safeSettings,
      status: evaluation.ready ? "configured" : "pending",
      lastCheckedAt: body.action === "check" ? now : null,
      updatedBy: auth.user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: identitySettings.id,
      set: {
        ...safeSettings,
        status: evaluation.ready ? "configured" : "pending",
        ...(body.action === "check" ? { lastCheckedAt: now } : {}),
        updatedBy: auth.user.id,
        updatedAt: now,
      },
    })
    .returning();

  await writeAuditLog({
    actor: auth.user,
    action: "security.identity.updated",
    resourceType: "identity_policy",
    resourceId: settings.id,
    summary: "La preconfiguración de SSO/MFA fue actualizada.",
    details: {
      providerName: settings.providerName ?? "",
      protocol: settings.protocol,
      organizationDomain: settings.organizationDomain ?? "",
      mfaPolicy: settings.mfaPolicy,
      mfaMethod: settings.mfaMethod,
      recoveryCodesRequired: settings.recoveryCodesRequired,
      requirementsReady: evaluation.completed,
      requirementsTotal: evaluation.total,
    },
    request,
  });
  return NextResponse.json({
    data: {
      settings,
      evaluation,
    },
  });
}
