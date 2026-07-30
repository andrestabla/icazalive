export const DEFAULT_BRAND = {
  organizationName: "Icaza Live",
  markText: "I",
  logoUrl: null as string | null,
  primaryColor: "#24194F",
  accentColor: "#6946E8",
  backgroundColor: "#FBFAFC",
  registrationButtonLabel: "Confirmar mi registro",
  footerText: "Tus datos están protegidos",
};

export type PublicBrand = typeof DEFAULT_BRAND;

// Mezcla la marca global con los colores propios del evento (si los definió).
export function applyEventBrand(
  brand: PublicBrand,
  event: {
    brandPrimaryColor?: string | null;
    brandAccentColor?: string | null;
    brandBackgroundColor?: string | null;
  },
): PublicBrand {
  return {
    ...brand,
    primaryColor: event.brandPrimaryColor ?? brand.primaryColor,
    accentColor: event.brandAccentColor ?? brand.accentColor,
    backgroundColor: event.brandBackgroundColor ?? brand.backgroundColor,
  };
}
