import type { PublicBrand } from "@/lib/brand-config";

export default function PublicBrandIdentity({
  brand,
}: {
  brand: PublicBrand;
}) {
  return (
    <div className="public-brand">
      {brand.logoUrl ? (
        // Dynamic customer logos cannot be restricted to a fixed set of hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="public-brand-logo"
          src={brand.logoUrl}
          alt=""
          width={32}
          height={32}
        />
      ) : (
        <img
          className="public-brand-logo official-brand-logo"
          src="/icaza-live-logo.png"
          alt="Icaza Jammoul Live"
          width={160}
          height={39}
        />
      )}
      {brand.logoUrl ? <span>{brand.organizationName}</span> : null}
    </div>
  );
}
