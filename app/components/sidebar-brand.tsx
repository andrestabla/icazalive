"use client";

import { useEffect, useState } from "react";
import type { PublicBrand } from "@/lib/brand-config";

// Logotipo (modo claro) y nombre en la barra lateral. Se piden al API al
// montar para que la barra pueda usarse también desde componentes cliente
// sin tocar la base de datos.
let cachedBrand: PublicBrand | null = null;

export default function SidebarBrand() {
  const [brand, setBrand] = useState<PublicBrand | null>(cachedBrand);

  useEffect(() => {
    if (cachedBrand) return;
    let cancelled = false;
    fetch("/api/brand", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: PublicBrand } | null) => {
        if (!cancelled && payload?.data) {
          cachedBrand = payload.data;
          setBrand(payload.data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const logo = brand?.logoLightUrl ?? brand?.logoDarkUrl ?? brand?.logoUrl ?? null;
  return (
    <>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="brand-logo" src={logo} alt="" width={32} height={32} />
      ) : (
        <div className="brand-mark">{brand?.markText ?? "I"}</div>
      )}
      <span>{brand?.organizationName ?? "Icaza Live"}</span>
    </>
  );
}
