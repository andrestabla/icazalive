import { DEFAULT_BRAND, type PublicBrand } from "@/lib/brand-config";

// Convierte el cuerpo de texto de una comunicación en un correo HTML con la
// marca de la plataforma: encabezado con logo (o el nombre de la organización),
// enlaces de la plataforma presentados como botones y pie institucional.
// El texto plano original se conserva como alternativa para clientes sin HTML.

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const URL_PATTERN = /https?:\/\/[^\s<]+/g;

function labelForLink(url: string): string | null {
  if (url.includes("/room/")) return "Entrar al evento";
  if (url.includes("/manage-registration/")) return "Gestionar mi inscripción";
  if (url.includes("/calendar")) return "Añadir al calendario";
  return null;
}

function buttonHtml(url: string, label: string, accentColor: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">` +
    `<tr><td style="border-radius:8px;background:${accentColor};">` +
    `<a href="${escapeHtml(url)}" target="_blank" ` +
    `style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:600;` +
    `font-family:Arial,Helvetica,sans-serif;font-size:14px;text-decoration:none;border-radius:8px;">` +
    `${escapeHtml(label)}</a></td></tr></table>`
  );
}

export function renderBrandedEmail(options: {
  bodyText: string;
  brand?: PublicBrand | null;
}): string {
  const brand = options.brand ?? DEFAULT_BRAND;
  const primary = brand.primaryColor || DEFAULT_BRAND.primaryColor;
  const accent = brand.accentColor || DEFAULT_BRAND.accentColor;
  const organization = brand.organizationName || DEFAULT_BRAND.organizationName;

  // Cada línea se procesa por separado: las URL de la plataforma se vuelven
  // botones (y la línea "Etiqueta: URL" se reemplaza completa por el botón);
  // el resto de URL quedan como enlaces normales.
  const paragraphs = options.bodyText.split(/\n{2,}/).map((paragraph) => {
    const lines = paragraph.split("\n").map((line) => {
      const urls = line.match(URL_PATTERN);
      if (!urls) return escapeHtml(line);
      let html = "";
      let remainder = line;
      for (const url of urls) {
        const [before, ...rest] = remainder.split(url);
        remainder = rest.join(url);
        const label = labelForLink(url);
        if (label) {
          // El texto previo tipo "Enlace de acceso:" sobra: el botón lo dice.
          const prefix = before.replace(/[\wáéíóúñÁÉÍÓÚÑ ]*:\s*$/u, "");
          html += escapeHtml(prefix) + buttonHtml(url, label, accent);
        } else {
          html +=
            escapeHtml(before) +
            `<a href="${escapeHtml(url)}" target="_blank" style="color:${accent};">${escapeHtml(url)}</a>`;
        }
      }
      return html + escapeHtml(remainder);
    });
    return `<p style="margin:0 0 16px;line-height:1.6;">${lines.join("<br />")}</p>`;
  });

  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(organization)}" height="40" style="display:block;max-height:40px;" />`
    : `<span style="display:inline-block;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:.02em;">${escapeHtml(organization)}</span>`;

  return (
    `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f2f1f6;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f1f6;padding:24px 0;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:94%;background:#ffffff;border-radius:12px;overflow:hidden;">` +
    `<tr><td style="background:${primary};padding:20px 32px;">${logo}</td></tr>` +
    `<tr><td style="padding:28px 32px;color:#2c2836;font-family:Arial,Helvetica,sans-serif;font-size:14px;">` +
    paragraphs.join("") +
    `</td></tr>` +
    `<tr><td style="padding:18px 32px;border-top:1px solid #ecebf1;color:#8a8695;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;">` +
    `${escapeHtml(organization)} · Recibiste este correo porque te registraste en uno de nuestros eventos.<br />${escapeHtml(brand.footerText || "")}` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}
