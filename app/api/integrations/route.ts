import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { integrationConnections } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { requireApiPermission } from "@/lib/api-guards";
import { readSesConfig, verifySesAccess } from "@/lib/aws-ses";
import { readIvsCredentials, verifyIvsAccess } from "@/lib/aws-ivs";
import { activeProviderName, providerLabels } from "@/lib/email-provider";
import {
  evaluateIntegration,
  type ManagedIntegrationProvider,
} from "@/lib/integrations";

export const runtime = "nodejs";

const providers: ManagedIntegrationProvider[] = [
  "zoom",
  "amazon_ivs",
  "amazon_s3",
  "email",
];

async function requireStaff() {
  const user = await requireApiUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (user.role === "participant") {
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
  if (!cleaned) return null;
  if (cleaned.length > maxLength) throw new Error("invalid");
  return cleaned;
}

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const records = await getDb()
    .select()
    .from(integrationConnections)
    .where(inArray(integrationConnections.provider, providers));
  const orderedRecords = providers
    .map((provider) => records.find((record) => record.provider === provider))
    .filter((record): record is NonNullable<typeof record> => Boolean(record));

  return NextResponse.json({
    data: orderedRecords.map((record) => ({
      connection: record,
      evaluation: evaluateIntegration({
        provider: record.provider as ManagedIntegrationProvider,
        accountLabel: record.accountLabel,
        externalAccountId: record.externalAccountId,
        region: record.region,
      }),
    })),
  });
}

export async function PATCH(request: Request) {
  const permissionCheck = await requireApiPermission("integrations.manage");
  if ("error" in permissionCheck) return permissionCheck.error;
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    provider?: ManagedIntegrationProvider;
    action?: "save" | "check";
    accountLabel?: string | null;
    externalAccountId?: string | null;
    region?: string | null;
  };
  if (
    !body.provider ||
    !providers.includes(body.provider) ||
    (body.action !== undefined &&
      body.action !== "save" &&
      body.action !== "check")
  ) {
    return NextResponse.json(
      { error: "La integración seleccionada no es válida." },
      { status: 400 },
    );
  }

  const db = getDb();
  const existingRecords = await db
    .select()
    .from(integrationConnections)
    .where(inArray(integrationConnections.provider, [body.provider]));
  const existing = existingRecords[0];

  let accountLabel: string | null;
  let externalAccountId: string | null;
  let region: string | null;
  try {
    accountLabel =
      body.accountLabel === undefined
        ? existing?.accountLabel ?? null
        : cleanText(body.accountLabel, 120);
    externalAccountId =
      body.externalAccountId === undefined
        ? existing?.externalAccountId ?? null
        : cleanText(body.externalAccountId, 500);
    region =
      body.region === undefined
        ? existing?.region ?? null
        : cleanText(body.region, 40);
  } catch {
    return NextResponse.json(
      { error: "Revisa los metadatos de la integración." },
      { status: 400 },
    );
  }
  if (region && !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region)) {
    return NextResponse.json(
      { error: "La región de AWS no tiene un formato válido." },
      { status: 400 },
    );
  }
  if (
    body.provider === "amazon_s3" &&
    externalAccountId &&
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(externalAccountId)
  ) {
    return NextResponse.json(
      { error: "El nombre del bucket de S3 no es válido." },
      { status: 400 },
    );
  }
  if (body.provider === "email") {
    if (
      accountLabel &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountLabel)
    ) {
      return NextResponse.json(
        {
          error:
            "El remitente debe ser una dirección de correo válida y verificada en SES.",
        },
        { status: 400 },
      );
    }
    if (
      externalAccountId &&
      !/^[A-Za-z0-9_-]{1,64}$/.test(externalAccountId)
    ) {
      return NextResponse.json(
        {
          error:
            "El conjunto de configuración de SES solo admite letras, números, guiones y guiones bajos.",
        },
        { status: 400 },
      );
    }
  }

  const safeRecord = {
    provider: body.provider,
    accountLabel,
    externalAccountId,
    region,
  };
  const evaluation = evaluateIntegration(safeRecord);
  const now = new Date();

  // Para el correo, "revisar" hace una consulta real a SES con las
  // credenciales del servidor: confirma acceso y si la cuenta está en sandbox.
  let providerCheck: {
    ok: boolean;
    detail: string;
    sandbox?: boolean;
    quota?: number;
    credentialsMissing?: boolean;
  } | null = null;
  // Para Amazon IVS, "revisar" comprueba que las credenciales del servidor
  // pueden listar canales, sin crear recursos.
  if (body.provider === "amazon_ivs" && body.action === "check") {
    const ivsCredentials = readIvsCredentials();
    if (!ivsCredentials) {
      providerCheck = {
        ok: false,
        credentialsMissing: true,
        detail:
          "Faltan variables de entorno de AWS. Define AWS_REGION, AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY para verificar la conexión.",
      };
    } else {
      providerCheck = await verifyIvsAccess({
        ...ivsCredentials,
        region: region ?? ivsCredentials.region,
      });
    }
  }

  if (body.provider === "email" && body.action === "check") {
    const sesConfig = readSesConfig();
    if (!sesConfig) {
      // Aún no hay credenciales: es una configuración incompleta, no un fallo.
      providerCheck = {
        ok: false,
        credentialsMissing: true,
        detail:
          "Faltan variables de entorno de SES. Define AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY, AWS_SES_REGION y EMAIL_FROM para verificar la conexión.",
      };
    } else {
      providerCheck = await verifySesAccess({
        ...sesConfig,
        region: region ?? sesConfig.region,
      });
    }
  }

  // "error" se reserva para credenciales presentes que el proveedor rechaza.
  const checkedProvider = body.provider === "email" || body.provider === "amazon_ivs";
  const status =
    checkedProvider && providerCheck && !providerCheck.credentialsMissing
      ? providerCheck.ok
        ? ("connected" as const)
        : ("error" as const)
      : existing?.status === "connected" && !checkedProvider
        ? ("connected" as const)
        : evaluation.ready
          ? ("configured" as const)
          : ("pending" as const);

  const [connection] = await db
    .insert(integrationConnections)
    .values({
      ...safeRecord,
      status,
      lastCheckedAt: body.action === "check" ? now : existing?.lastCheckedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: integrationConnections.provider,
      set: {
        accountLabel,
        externalAccountId,
        region,
        status,
        lastCheckedAt: body.action === "check" ? now : existing?.lastCheckedAt,
        updatedAt: now,
      },
    })
    .returning();

  await writeAuditLog({
    actor: auth.user,
    action:
      body.action === "check"
        ? "integration.checked"
        : "integration.updated",
    resourceType: "integration",
    resourceId: body.provider,
    summary: `${body.provider} fue ${body.action === "check" ? "revisada" : "actualizada"}.`,
    details: {
      provider: body.provider,
      status,
      accountLabel: accountLabel ?? "",
      region: region ?? "",
      resourceConfigured: Boolean(externalAccountId),
      requirementsReady: evaluation.completed,
      requirementsTotal: evaluation.total,
    },
    request,
  });
  return NextResponse.json({
    data: {
      connection,
      evaluation,
      providerCheck,
      activeEmailProvider:
        body.provider === "email"
          ? providerLabels[activeProviderName()]
          : undefined,
    },
  });
}
