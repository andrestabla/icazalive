import Image from "next/image";

export type ServiceLogoName =
  | "zoom"
  | "amazon_ivs"
  | "amazon_s3"
  | "amazon_ses";

const serviceMarks: Record<ServiceLogoName, { src: string; label: string }> = {
  zoom: { src: "/brands/zoom.svg", label: "Zoom" },
  amazon_ivs: { src: "/brands/amazon-ivs.png", label: "Amazon IVS" },
  amazon_s3: { src: "/brands/amazon-s3.png", label: "Amazon S3" },
  amazon_ses: { src: "/brands/amazon-ses.png", label: "Amazon SES" },
};

export function ServiceLogo({
  service,
  className = "",
}: {
  service: ServiceLogoName;
  className?: string;
}) {
  const mark = serviceMarks[service];
  return (
    <span className={`service-logo ${service} ${className}`.trim()} aria-hidden="true">
      <Image src={mark.src} alt="" width={32} height={32} />
    </span>
  );
}