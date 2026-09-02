// Indicador de carga con la marca de la plataforma. Si el administrador subió
// un loader (GIF, SVG animado, WebP o video corto) se usa; si no, un anillo
// con el color de acento. La URL llega por la variable CSS --brand-loader-url
// que define el layout raíz, así que también sirve dentro de loading.tsx.
export default function BrandLoader({
  label = "Cargando…",
  size = 64,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div className="brand-loader" role="status" aria-live="polite">
      <span className="brand-loader-figure" style={{ width: size, height: size }} aria-hidden="true">
        <span className="brand-loader-ring" />
        <span className="brand-loader-image" />
      </span>
      <p>{label}</p>
    </div>
  );
}
