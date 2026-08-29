export type StreamingMode =
  | "zoom_only"
  | "zoom_to_ivs"
  | "ivs_direct"
  | "simulated";

export type StreamingCheck = {
  id: "schedule" | "source" | "distribution" | "credentials" | "signal";
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
};

type StreamingConfiguration = {
  mode: StreamingMode;
  startsAt: Date;
  endsAt: Date;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  ivsChannelArn: string | null;
  playbackUrl: string | null;
  zoomCredentialsConfigured: boolean;
  awsCredentialsConfigured: boolean;
};

export function getCredentialAvailability() {
  return {
    zoomCredentialsConfigured: Boolean(
      process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET,
    ),
    awsCredentialsConfigured: Boolean(
      process.env.AWS_REGION &&
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY,
    ),
    awsRegion: process.env.AWS_REGION || "us-east-1",
  };
}

export function evaluateStreamingConfiguration(
  configuration: StreamingConfiguration,
): StreamingCheck[] {
  const needsZoom =
    configuration.mode === "zoom_only" ||
    configuration.mode === "zoom_to_ivs";
  const needsIvs =
    configuration.mode === "zoom_to_ivs" ||
    configuration.mode === "ivs_direct";
  const scheduleValid =
    configuration.startsAt.getTime() < configuration.endsAt.getTime();
  const zoomConfigured = Boolean(
    configuration.zoomMeetingId && configuration.zoomJoinUrl,
  );
  const ivsConfigured = Boolean(
    configuration.ivsChannelArn && configuration.playbackUrl,
  );

  const checks: StreamingCheck[] = [
    {
      id: "schedule",
      label: "Horario de la sesión",
      status: scheduleValid ? "pass" : "fail",
      detail: scheduleValid
        ? "Inicio, duración y zona horaria definidos."
        : "La sesión debe terminar después de su hora de inicio.",
    },
    {
      id: "source",
      label: "Fuente de video",
      status: needsZoom && !zoomConfigured ? "fail" : "pass",
      detail:
        configuration.mode === "simulated"
          ? "El evento utilizará contenido pregrabado."
          : needsZoom
            ? zoomConfigured
              ? "Reunión y enlace de Zoom configurados."
              : "Faltan el ID o el enlace de la reunión de Zoom."
            : "La señal ingresará directamente a Amazon IVS.",
    },
    {
      id: "distribution",
      label: "Distribución al público",
      status: needsIvs && !ivsConfigured ? "fail" : "pass",
      detail:
        configuration.mode === "simulated"
          ? "La reproducción se configurará con el contenido simulado."
          : needsIvs
            ? ivsConfigured
              ? "Canal y URL de reproducción de Amazon IVS configurados."
              : "Faltan el ARN del canal o la URL de reproducción de IVS."
            : "Los participantes ingresarán directamente a Zoom.",
    },
  ];

  if (configuration.mode === "simulated") {
    checks.push({
      id: "credentials",
      label: "Credenciales externas",
      status: "pass",
      detail: "No son necesarias para validar este evento simulado.",
    });
  } else {
    const missingCredentials = [
      needsZoom && !configuration.zoomCredentialsConfigured ? "Zoom" : null,
      needsIvs && !configuration.awsCredentialsConfigured ? "AWS" : null,
    ].filter(Boolean);
    checks.push({
      id: "credentials",
      label: "Conexiones externas",
      status: missingCredentials.length ? "warning" : "pass",
      detail: missingCredentials.length
        ? `Configuración local válida; faltan credenciales de ${missingCredentials.join(" y ")} para conectarse.`
        : "Las credenciales necesarias están disponibles en el servidor.",
    });
  }

  return checks;
}

export function hasBlockingStreamingChecks(checks: StreamingCheck[]) {
  return checks.some((check) => check.status === "fail");
}
