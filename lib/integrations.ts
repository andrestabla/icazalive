export type ManagedIntegrationProvider =
  | "zoom"
  | "amazon_ivs"
  | "amazon_s3"
  | "email";

export type IntegrationRequirement = {
  key: string;
  label: string;
  ready: boolean;
  source: "server" | "database";
};

export type SafeIntegrationRecord = {
  provider: ManagedIntegrationProvider;
  accountLabel: string | null;
  externalAccountId: string | null;
  region: string | null;
};

export function getIntegrationEnvironment() {
  return {
    zoomClientId: Boolean(process.env.ZOOM_CLIENT_ID),
    zoomClientSecret: Boolean(process.env.ZOOM_CLIENT_SECRET),
    zoomRedirectUri: Boolean(process.env.ZOOM_REDIRECT_URI),
    awsRegion: process.env.AWS_REGION || "us-east-1",
    awsAccessKey: Boolean(process.env.AWS_ACCESS_KEY_ID),
    awsSecretKey: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
    s3BucketName: process.env.AWS_S3_BUCKET || null,
    // El checklist refleja la misma regla que readSesConfig(): solo cuentan
    // las variables específicas de SES, sin heredar las genéricas de AWS.
    sesRegion: process.env.AWS_SES_REGION || null,
    sesAccessKey: Boolean(process.env.AWS_SES_ACCESS_KEY_ID),
    sesSecretKey: Boolean(process.env.AWS_SES_SECRET_ACCESS_KEY),
    emailFrom: process.env.EMAIL_FROM || null,
    emailReplyTo: process.env.EMAIL_REPLY_TO || null,
    sesConfigurationSet: process.env.AWS_SES_CONFIGURATION_SET || null,
  };
}

export function evaluateIntegration(record: SafeIntegrationRecord) {
  const environment = getIntegrationEnvironment();
  let requirements: IntegrationRequirement[];

  if (record.provider === "zoom") {
    requirements = [
      {
        key: "zoom_client_id",
        label: "ZOOM_CLIENT_ID",
        ready: environment.zoomClientId,
        source: "server",
      },
      {
        key: "zoom_client_secret",
        label: "ZOOM_CLIENT_SECRET",
        ready: environment.zoomClientSecret,
        source: "server",
      },
      {
        key: "zoom_redirect_uri",
        label: "URL de retorno OAuth",
        ready: environment.zoomRedirectUri,
        source: "server",
      },
    ];
  } else if (record.provider === "amazon_ivs") {
    requirements = [
      {
        key: "aws_access_key",
        label: "AWS_ACCESS_KEY_ID",
        ready: environment.awsAccessKey,
        source: "server",
      },
      {
        key: "aws_secret_key",
        label: "AWS_SECRET_ACCESS_KEY",
        ready: environment.awsSecretKey,
        source: "server",
      },
      {
        key: "aws_region",
        label: "Región de AWS",
        ready: Boolean(record.region || environment.awsRegion),
        source: "database",
      },
    ];
  } else if (record.provider === "email") {
    requirements = [
      {
        key: "ses_access_key",
        label: "AWS_SES_ACCESS_KEY_ID",
        ready: environment.sesAccessKey,
        source: "server",
      },
      {
        key: "ses_secret_key",
        label: "AWS_SES_SECRET_ACCESS_KEY",
        ready: environment.sesSecretKey,
        source: "server",
      },
      {
        key: "email_from",
        label: "EMAIL_FROM (remitente verificado)",
        ready: Boolean(environment.emailFrom),
        source: "server",
      },
      {
        key: "ses_region",
        label: "Región de SES",
        ready: Boolean(record.region || environment.sesRegion),
        source: record.region ? "database" : "server",
      },
      {
        key: "ses_sender_identity",
        label: "Identidad del remitente registrada",
        ready: Boolean(record.accountLabel),
        source: "database",
      },
    ];
  } else {
    requirements = [
      {
        key: "aws_access_key",
        label: "AWS_ACCESS_KEY_ID",
        ready: environment.awsAccessKey,
        source: "server",
      },
      {
        key: "aws_secret_key",
        label: "AWS_SECRET_ACCESS_KEY",
        ready: environment.awsSecretKey,
        source: "server",
      },
      {
        key: "s3_bucket",
        label: "Bucket para grabaciones",
        ready: Boolean(record.externalAccountId || environment.s3BucketName),
        source: record.externalAccountId ? "database" : "server",
      },
    ];
  }

  return {
    requirements,
    ready: requirements.every((requirement) => requirement.ready),
    completed: requirements.filter((requirement) => requirement.ready).length,
    total: requirements.length,
    runtime: {
      region: record.region || environment.awsRegion,
      bucketConfigured: Boolean(
        record.externalAccountId || environment.s3BucketName,
      ),
      redirectUri:
        process.env.ZOOM_REDIRECT_URI ??
        "http://localhost:3000/api/integrations/zoom/callback",
      emailFrom: environment.emailFrom,
      emailReplyTo: environment.emailReplyTo,
      sesRegion: environment.sesRegion,
      sesConfigurationSet:
        record.externalAccountId || environment.sesConfigurationSet,
    },
  };
}
