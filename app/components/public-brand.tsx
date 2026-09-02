import type { PublicBrand } from "@/lib/brand-config";

// Identidad pública: logo para fondo oscuro (hero, sala) o claro (paneles).
// Cae al logo del otro fondo, a la URL externa o al monograma, en ese orden.
export function brandLogoFor(brand: PublicBrand, surface: "dark" | "light"): string | null {
  return surface === "dark"
    ? brand.logoDarkUrl ?? brand.logoLightUrl ?? brand.logoUrl
    : brand.logoLightUrl ?? brand.logoDarkUrl ?? brand.logoUrl;
}

export default function PublicBrandIdentity({
  brand,
  surface = "dark",
}: {
  brand: PublicBrand;
  surface?: "dark" | "light";
}) {
  const logo = brandLogoFor(brand, surface);
  return (
    <div className="public-brand">
      {logo ? (
        // Dynamic customer logos cannot be restricted to a fixed set of hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="public-brand-logo"
          src={logo}
          alt=""
          width={32}
          height={32}
        />
      ) : (
        // Sin logo configurado: logotipo oficial de la plataforma.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="public-brand-logo official-brand-logo"
          src="/icaza-live-logo.png"
          alt={brand.organizationName}
          width={160}
          height={39}
        />
      )}
      {logo ? <span>{brand.organizationName}</span> : null}
    </div>
  );
}
