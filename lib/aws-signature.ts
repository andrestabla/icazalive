import { createHash, createHmac } from "node:crypto";

// Firma SigV4 compartida por los clientes de AWS del proyecto (IVS y S3).
// Se mantiene sin SDK, igual que `lib/aws-ses.ts`, para no arrastrar
// dependencias pesadas ni credenciales fuera de las variables de entorno.

export type AwsCredentials = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
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

export type SignedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
};

// Construye los encabezados firmados de una petición. `payloadHash` se recibe
// ya calculado para permitir cargas en streaming, donde el cuerpo no cabe en
// memoria y el hash se conoce por otra vía (o es UNSIGNED-PAYLOAD).
export function signRequest(options: {
  credentials: AwsCredentials;
  service: string;
  host: string;
  method: string;
  path: string;
  query?: string;
  payloadHash: string;
  extraHeaders?: Record<string, string>;
  amzDate?: string;
}): SignedRequest {
  const {
    credentials,
    service,
    host,
    method,
    path,
    query = "",
    payloadHash,
    extraHeaders = {},
  } = options;

  const amzDate =
    options.amzDate ?? new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(credentials.sessionToken
      ? { "x-amz-security-token": credentials.sessionToken }
      : {}),
  };
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers[name.toLowerCase()] = value;
  }

  const sortedNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join("");
  const signedHeaders = sortedNames.join(";");

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${credentials.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    signingKey(
      credentials.secretAccessKey,
      dateStamp,
      credentials.region,
      service,
    ),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    url: `https://${host}${path}${query ? `?${query}` : ""}`,
    method,
    headers: {
      ...Object.fromEntries(
        sortedNames.map((name) => [name, headers[name]]),
      ),
      Authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

// Firma en la cadena de consulta (query string). Se usa para entregar al
// navegador una URL temporal de S3: el video no atraviesa el servidor de la
// aplicación, que en Replit tiene memoria y ancho de banda limitados.
export function presignUrl(options: {
  credentials: AwsCredentials;
  service: string;
  host: string;
  method: string;
  path: string;
  expiresInSeconds: number;
}): string {
  const { credentials, service, host, method, path, expiresInSeconds } = options;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${credentials.region}/${service}/aws4_request`;

  const parameters: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${credentials.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
    ...(credentials.sessionToken
      ? { "X-Amz-Security-Token": credentials.sessionToken }
      : {}),
  };

  const canonicalQuery = Object.keys(parameters)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`,
    )
    .join("&");

  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    signingKey(
      credentials.secretAccessKey,
      dateStamp,
      credentials.region,
      service,
    ),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
