import { notFound } from "next/navigation";
import { getBrandSettings } from "@/lib/brand";
import { findTicketByToken } from "@/lib/support";
import TicketView from "./ticket-view";
import "./ticket.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi caso de soporte — Icaza Jammoul Live",
  robots: { index: false, follow: false },
};

// Seguimiento del solicitante: el enlace con token llega en cada correo del
// caso. No requiere iniciar sesión.
export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const ticket = await findTicketByToken(decoded);
  if (!ticket) notFound();
  const brand = await getBrandSettings().catch(() => null);
  return <TicketView token={decoded} organization={brand?.organizationName ?? "Icaza Jammoul Live"} logo={brand?.logoLightUrl ?? brand?.logoUrl ?? null} />;
}
