import PublicHome from "../public-home";

export const metadata = {
  title: "Icaza Jammoul Live — Plataforma de eventos corporativos",
  description:
    "Plataforma privada con la que Icaza Jammoul organiza y transmite sus eventos corporativos en vivo, híbridos y simulados.",
};

// Página pública informativa del servicio. La raíz del dominio lleva al acceso
// del equipo; esta ruta queda como referencia pública (proveedores de correo,
// documentos legales y contacto).
export default function InfoPage() {
  return <PublicHome />;
}
