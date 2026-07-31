import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { brandSettings } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { requireApiPermission } from "@/lib/api-guards";
import { getBrandSettings } from "@/lib/brand";
import { DEFAULT_BRAND } from "@/lib/brand-config";

export const runtime = "nodejs";

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

function cleanText(value: unknown, minLength: number, maxLength: number) {
  if (typeof value !== "string") throw new Error("invalid");
  const cleaned = value.trim();
  if (cleaned.length < minLength || cleaned.length > maxLength) {
    throw new Error("invalid");
  }
  return cleaned;
}

function cleanColor(value: unknown) {
  const color = cleanText(value, 7, 7).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) throw new Error("invalid");
  return color;
}

function cleanLogoUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const candidate = cleanText(value, 1, 500);
  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("invalid");
  }
  return url.toString();
}

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ data: await getBrandSettings() });
}

export async function PATCH(request: Request) {
  const permissionCheck = await requireApiPermission("brand.manage");
  if ("error" in permissionCheck) return permissionCheck.error;
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as Partial<typeof DEFAULT_BRAND>;
  let values: typeof DEFAULT_BRAND;
  try {
    const markText = cleanText(body.markText, 1, 3).toUpperCase();
    if (!/^[\p{L}\p{N}]{1,3}$/u.test(markText)) throw new Error("invalid");
    values = {
      organizationName: cleanText(body.organizationName, 2, 80),
      markText,
      logoUrl: cleanLogoUrl(body.logoUrl),
      primaryColor: cleanColor(body.primaryColor),
      accentColor: cleanColor(body.accentColor),
      backgroundColor: cleanColor(body.backgroundColor),
      registrationButtonLabel: cleanText(
        body.registrationButtonLabel,
        3,
        60,
      ),
      footerText: cleanText(body.footerText, 3, 160),
    };
  } catch {
    return NextResponse.json(
      { error: "Revisa los datos, colores y URL de la identidad visual." },
      { status: 400 },
    );
  }

  const now = new Date();
  const [record] = await getDb()
    .insert(brandSettings)
    .values({
      id: "default",
      ...values,
      updatedBy: auth.user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: brandSettings.id,
      set: {
        ...values,
        updatedBy: auth.user.id,
        updatedAt: now,
      },
    })
    .returning();

  await writeAuditLog({
    actor: auth.user,
    action: "brand.updated",
    resourceType: "brand",
    resourceId: record.id,
    summary: "La identidad visual global fue actualizada.",
    details: {
      organizationName: record.organizationName,
      primaryColor: record.primaryColor,
      accentColor: record.accentColor,
      logoConfigured: Boolean(record.logoUrl),
    },
    request,
  });
  return NextResponse.json({ data: record });
}
