import { createHash, createHmac } from "node:crypto";

// Cliente mínimo de Amazon SES v2 firmado con SigV4, sin SDK de AWS.
// Las credenciales se leen solo de variables de entorno del servidor.

export type SesConfig = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  fromAddress: string;
  configurationSet?: string;
};

export function readSesConfig(): SesConfig | null {
  const region = process.env.AWS_SES_REGION || process.env.AWS_REGION;
  const accessKeyId =
    process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const fromAddress = process.env.EMAIL_FROM;

  if (!region || !accessKeyId || !secretAccessKey || !fromAddress) return null;
  return {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    fromAddress,
    configurationSet: process.env.AWS_SES_CONFIGURATION_SET,
  };
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function signingKey(
  secretAccessKey: string,
  date: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export type SesSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

export async function sendWithSes(
  config: SesConfig,
  email: { to: string; subject: string; body: string; replyTo?: string },
): Promise<SesSendResult> {
  const service = "ses";
  const host = `email.${config.region}.amazonaws.com`;
  const endpoint = `https://${host}/v2/email/outbound-emails`;

  const payload = JSON.stringify({
    FromEmailAddress: config.fromAddress,
    Destination: { ToAddresses: [email.to] },
    ...(email.replyTo ? { ReplyToAddresses: [email.replyTo] } : {}),
    ...(config.configurationSet
      ? { ConfigurationSetName: config.configurationSet }
      : {}),
    Content: {
      Simple: {
        Subject: { Data: email.subject, Charset: "UTF-8" },
        Body: { Text: { Data: email.body, Charset: "UTF-8" } },
      },
    },
  });

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(payload);

  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n` +
    (config.sessionToken ? `x-amz-security-token:${config.sessionToken}\n` : "");
  const signedHeaders = `content-type;host;x-amz-content-sha256;x-amz-date${
    config.sessionToken ? ";x-amz-security-token" : ""
  }`;

  const canonicalRequest = [
    "POST",
    "/v2/email/outbound-emails",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    signingKey(config.secretAccessKey, dateStamp, config.region, service),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amz-Content-Sha256": payloadHash,
        "X-Amz-Date": amzDate,
        Authorization: authorization,
        ...(config.sessionToken
          ? { "X-Amz-Security-Token": config.sessionToken }
          : {}),
      },
      body: payload,
    });

    if (response.ok) {
      const result = (await response.json()) as { MessageId?: string };
      return { ok: true, messageId: result.MessageId ?? "ses" };
    }

    const detail = await response.text();
    // 4xx (credenciales, remitente sin verificar, cuota) no se reintenta;
    // 429 y 5xx sí, porque suelen ser transitorios.
    const retryable = response.status === 429 || response.status >= 500;
    return {
      ok: false,
      error: `SES ${response.status}: ${detail.slice(0, 300)}`,
      retryable,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fallo de red con SES.",
      retryable: true,
    };
  }
}

// Verificación de credenciales sin enviar correo: consulta la cuenta de SES.
export async function verifySesAccess(
  config: SesConfig,
): Promise<{ ok: boolean; detail: string; sandbox?: boolean; quota?: number }> {
  const service = "ses";
  const host = `email.${config.region}.amazonaws.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex("");

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n` +
    (config.sessionToken ? `x-amz-security-token:${config.sessionToken}\n` : "");
  const signedHeaders = `host;x-amz-content-sha256;x-amz-date${
    config.sessionToken ? ";x-amz-security-token" : ""
  }`;
  const canonicalRequest = [
    "GET",
    "/v2/email/account",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    signingKey(config.secretAccessKey, dateStamp, config.region, service),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  try {
    const response = await fetch(`https://${host}/v2/email/account`, {
      headers: {
        "X-Amz-Content-Sha256": payloadHash,
        "X-Amz-Date": amzDate,
        Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        ...(config.sessionToken
          ? { "X-Amz-Security-Token": config.sessionToken }
          : {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, detail: `SES ${response.status}: ${detail.slice(0, 200)}` };
    }
    const account = (await response.json()) as {
      ProductionAccessEnabled?: boolean;
      SendQuota?: { Max24HourSend?: number };
    };
    return {
      ok: true,
      detail: account.ProductionAccessEnabled
        ? "Acceso de producción habilitado."
        : "La cuenta está en modo prueba (sandbox): solo entrega a direcciones verificadas.",
      sandbox: !account.ProductionAccessEnabled,
      quota: account.SendQuota?.Max24HourSend,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "No fue posible contactar a SES.",
    };
  }
}
