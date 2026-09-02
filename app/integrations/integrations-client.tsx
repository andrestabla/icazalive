"use client";

import Link from "next/link";
import ExtraIntegrationCards from "./config-cards";
import { useState } from "react";
import type {
  IdentityProtocol,
  MfaMethod,
  MfaPolicy,
} from "@/lib/identity-settings";
import type {
  IntegrationRequirement,
  ManagedIntegrationProvider,
} from "@/lib/integrations";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

type ConnectionStatus =
  | "disconnected"
  | "pending"
  | "configured"
  | "connected"
  | "error";

type Connection = {
  id: string;
  provider: ManagedIntegrationProvider;
  status: ConnectionStatus;
  accountLabel: string | null;
  externalAccountId: string | null;
  region: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Evaluation = {
  requirements: IntegrationRequirement[];
  ready: boolean;
  completed: number;
  total: number;
  runtime: {
    region: string;
    bucketConfigured: boolean;
    redirectUri: string;
  };
};

type IntegrationItem = {
  connection: Connection;
  evaluation: Evaluation;
};

type IdentitySettings = {
  id: string;
  status: ConnectionStatus;
  providerName: string | null;
  protocol: IdentityProtocol;
  organizationDomain: string | null;
  issuerUrl: string | null;
  clientId: string | null;
  entityId: string | null;
  mfaPolicy: MfaPolicy;
  mfaMethod: MfaMethod;
  recoveryCodesRequired: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type IdentityEvaluation = {
  requirements: IntegrationRequirement[];
  ready: boolean;
  completed: number;
  total: number;
  runtime: {
    callbackUrl: string;
    protocol: IdentityProtocol;
    mfaMethod: MfaMethod;
  };
};

type IdentityItem = {
  settings: IdentitySettings;
  evaluation: IdentityEvaluation;
};

type WizardKind = "zoom" | "aws" | "identity" | "email";

const providerContent: Record<
  ManagedIntegrationProvider,
  {
    name: string;
    eyebrow: string;
    description: string;
    logo: string;
    resourceLabel: string;
    resourcePlaceholder: string;
  }
> = {
  zoom: {
    name: "Zoom",
    eyebrow: "FUENTE DE VIDEO",
    description: "Reuniones para anfitriones, presentadores e invitados.",
    logo: "zoom",
    resourceLabel: "ID de la cuenta (opcional)",
    resourcePlaceholder: "Cuenta de Zoom",
  },
  amazon_ivs: {
    name: "Amazon IVS",
    eyebrow: "DISTRIBUCIÓN EN VIVO",
    description:
      "Canales de video administrados y reproducción de baja latencia.",
    logo: "aws",
    resourceLabel: "ARN de canal predeterminado (opcional)",
    resourcePlaceholder: "arn:aws:ivs:...",
  },
  amazon_s3: {
    name: "Amazon S3",
    eyebrow: "GRABACIONES",
    description: "Almacenamiento de grabaciones y recursos posteriores.",
    logo: "aws",
    resourceLabel: "Nombre del bucket",
    resourcePlaceholder: "icaza-live-recordings",
  },
  email: {
    name: "Amazon SES",
    eyebrow: "CORREO SALIENTE",
    description:
      "Confirmaciones, recordatorios e invitaciones enviadas a los asistentes.",
    logo: "aws",
    resourceLabel: "Conjunto de configuración (opcional)",
    resourcePlaceholder: "icaza-live-eventos",
  },
};

const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: "Sin configurar",
  pending: "Pendiente",
  configured: "Preparada",
  connected: "Conectada",
  error: "Con error",
};

const wizardContent: Record<
  WizardKind,
  { eyebrow: string; title: string; description: string; steps: string[] }
> = {
  zoom: {
    eyebrow: "ASISTENTE DE ZOOM",
    title: "Preparar Zoom OAuth",
    description:
      "Configura la cuenta, la URL de retorno y las variables que luego irán en Secrets.",
    steps: ["Arquitectura", "Cuenta", "Secretos", "Revisión"],
  },
  aws: {
    eyebrow: "ASISTENTE DE AWS",
    title: "Preparar IVS y S3",
    description:
      "Define región, canal y bucket para el recorrido de transmisión y grabación.",
    steps: ["Arquitectura", "Recursos", "Credenciales", "Revisión"],
  },
  identity: {
    eyebrow: "ASISTENTE DE IDENTIDAD",
    title: "Preparar SSO y MFA",
    description:
      "Deja lista la federación corporativa y la política de segundo factor sin almacenar secretos.",
    steps: ["Proveedor", "Protocolo", "MFA", "Revisión"],
  },
  email: {
    eyebrow: "ASISTENTE DE CORREO",
    title: "Configurar correo saliente con Amazon SES",
    description:
      "Define el remitente verificado y la región; las credenciales permanecen en variables del servidor.",
    steps: ["Cómo funciona", "Remitente", "Credenciales", "Verificación"],
  },
};

function completionPercent(completed: number, total: number) {
  return total ? Math.round((completed / total) * 100) : 0;
}

function formatStableDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PLATFORM_TIMEZONE,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts
      .find((item) => item.type === type)
      ?.value.replace(/\s+/g, " ") ?? "";
  return `${part("day")} ${part("month")} ${part("year")} · ${part("hour")}:${part("minute")} ${part("dayPeriod")}`.trim();
}

function requirementList(requirements: IntegrationRequirement[]) {
  return (
    <div className="wizard-requirement-list">
      {requirements.map((requirement) => (
        <div key={requirement.key}>
          <span className={requirement.ready ? "ready" : ""}>
            {requirement.ready ? "✓" : "·"}
          </span>
          <p>
            <b>{requirement.label}</b>
            <small>
              {requirement.source === "server"
                ? "Variable segura del servidor"
                : "Configuración guardada"}
            </small>
          </p>
        </div>
      ))}
    </div>
  );
}

export default function IntegrationsClient({
  initialConnections,
  initialIdentity,
  canManageIdentity,
  eventCount,
  readySessionCount,
}: {
  initialConnections: IntegrationItem[];
  initialIdentity: IdentityItem;
  canManageIdentity: boolean;
  eventCount: number;
  readySessionCount: number;
}) {
  const [items, setItems] = useState(initialConnections);
  const [identity, setIdentity] = useState(initialIdentity);
  const [savingProvider, setSavingProvider] =
    useState<ManagedIntegrationProvider | null>(null);
  const [wizard, setWizard] = useState<WizardKind | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardError, setWizardError] = useState("");
  const [message, setMessage] = useState("");
  const [zoomDraft, setZoomDraft] = useState(
    initialConnections.find((item) => item.connection.provider === "zoom")!
      .connection,
  );
  const [ivsDraft, setIvsDraft] = useState(
    initialConnections.find((item) => item.connection.provider === "amazon_ivs")!
      .connection,
  );
  const [s3Draft, setS3Draft] = useState(
    initialConnections.find((item) => item.connection.provider === "amazon_s3")!
      .connection,
  );
  const [emailDraft, setEmailDraft] = useState(
    initialConnections.find((item) => item.connection.provider === "email")!
      .connection,
  );
  const [emailCheck, setEmailCheck] = useState<{
    ok: boolean;
    detail: string;
    sandbox?: boolean;
    quota?: number;
    credentialsMissing?: boolean;
  } | null>(null);
  const [identityDraft, setIdentityDraft] = useState(initialIdentity.settings);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    ok: boolean;
    detail: string;
  } | null>(null);

  const sendTestEmail = async () => {
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const response = await fetch("/api/integrations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          action: "test_send",
          testRecipient: testEmailTo,
        }),
      });
      const payload = (await response.json()) as {
        data?: { testSend?: { ok: boolean; detail: string } };
        error?: string;
      };
      if (!response.ok || !payload.data?.testSend) {
        setTestEmailResult({
          ok: false,
          detail: payload.error ?? "No fue posible enviar el correo de prueba.",
        });
      } else {
        setTestEmailResult(payload.data.testSend);
      }
    } catch {
      setTestEmailResult({
        ok: false,
        detail: "No fue posible contactar al servidor.",
      });
    } finally {
      setTestEmailSending(false);
    }
  };

  const itemFor = (provider: ManagedIntegrationProvider) =>
    items.find((item) => item.connection.provider === provider)!;
  const zoomItem = itemFor("zoom");
  const ivsItem = itemFor("amazon_ivs");
  const s3Item = itemFor("amazon_s3");
  const emailItem = itemFor("email");
  const readyConnections =
    items.filter((item) => item.evaluation.ready).length +
    (identity.evaluation.ready ? 1 : 0);
  const completedRequirements =
    items.reduce(
      (total, item) => total + item.evaluation.completed,
      identity.evaluation.completed,
    );
  const totalRequirements =
    items.reduce(
      (total, item) => total + item.evaluation.total,
      identity.evaluation.total,
    );

  const updateConnection = (
    provider: ManagedIntegrationProvider,
    changes: Partial<Connection>,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.connection.provider === provider
          ? {
              ...item,
              connection: { ...item.connection, ...changes },
            }
          : item,
      ),
    );
  };

  const persistConnection = async (
    connection: Connection,
    action: "save" | "check",
  ) => {
    setSavingProvider(connection.provider);
    const response = await fetch("/api/integrations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: connection.provider,
        action,
        accountLabel: connection.accountLabel,
        externalAccountId: connection.externalAccountId,
        region: connection.region,
      }),
    });
    const payload = (await response.json()) as {
      data?: IntegrationItem & {
        providerCheck?: {
          ok: boolean;
          detail: string;
          sandbox?: boolean;
          quota?: number;
          credentialsMissing?: boolean;
        } | null;
      };
      error?: string;
    };
    setSavingProvider(null);
    if (!response.ok || !payload.data) {
      throw new Error(
        payload.error ?? "No fue posible guardar la integración.",
      );
    }
    const normalized: IntegrationItem = {
      connection: {
        ...payload.data.connection,
        lastCheckedAt: payload.data.connection.lastCheckedAt
          ? new Date(payload.data.connection.lastCheckedAt).toISOString()
          : null,
        createdAt: new Date(payload.data.connection.createdAt).toISOString(),
        updatedAt: new Date(payload.data.connection.updatedAt).toISOString(),
      },
      evaluation: payload.data.evaluation,
    };
    const providerCheck = payload.data.providerCheck ?? null;
    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.connection.provider === connection.provider
          ? normalized
          : currentItem,
      ),
    );
    return { ...normalized, providerCheck };
  };

  const saveConnection = async (
    item: IntegrationItem,
    action: "save" | "check",
  ) => {
    setMessage("");
    try {
      const saved = await persistConnection(item.connection, action);
      setMessage(
        saved.evaluation.ready
          ? `${providerContent[item.connection.provider].name} está preparada localmente.`
          : "Metadatos guardados; todavía faltan variables seguras en el servidor.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible guardar la integración.",
      );
    }
  };

  const openWizard = (kind: WizardKind) => {
    if (kind === "identity" && !canManageIdentity) return;
    setZoomDraft({ ...zoomItem.connection });
    setIvsDraft({ ...ivsItem.connection });
    setS3Draft({ ...s3Item.connection });
    setIdentityDraft({ ...identity.settings });
    setWizardStep(0);
    setWizardError("");
    setWizard(kind);
  };

  const saveIdentity = async () => {
    const response = await fetch("/api/security-setup", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "check",
        providerName: identityDraft.providerName,
        protocol: identityDraft.protocol,
        organizationDomain: identityDraft.organizationDomain,
        issuerUrl: identityDraft.issuerUrl,
        clientId: identityDraft.clientId,
        entityId: identityDraft.entityId,
        mfaPolicy: identityDraft.mfaPolicy,
        mfaMethod: identityDraft.mfaMethod,
        recoveryCodesRequired: identityDraft.recoveryCodesRequired,
      }),
    });
    const payload = (await response.json()) as {
      data?: IdentityItem;
      error?: string;
    };
    if (!response.ok || !payload.data) {
      throw new Error(
        payload.error ?? "No fue posible guardar la política de identidad.",
      );
    }
    const normalized: IdentityItem = {
      settings: {
        ...payload.data.settings,
        lastCheckedAt: payload.data.settings.lastCheckedAt
          ? new Date(payload.data.settings.lastCheckedAt).toISOString()
          : null,
        createdAt: new Date(payload.data.settings.createdAt).toISOString(),
        updatedAt: new Date(payload.data.settings.updatedAt).toISOString(),
      },
      evaluation: payload.data.evaluation,
    };
    setIdentity(normalized);
  };

  const completeWizard = async () => {
    if (!wizard) return;
    setWizardSaving(true);
    setWizardError("");
    try {
      if (wizard === "zoom") {
        const saved = await persistConnection(zoomDraft, "check");
        setMessage(
          saved.evaluation.ready
            ? "El asistente de Zoom quedó preparado."
            : "Zoom quedó preconfigurado; faltan sus secretos del servidor.",
        );
      } else if (wizard === "aws") {
        const [savedIvs, savedS3] = await Promise.all([
          persistConnection(ivsDraft, "check"),
          persistConnection(s3Draft, "check"),
        ]);
        setMessage(
          savedIvs.evaluation.ready && savedS3.evaluation.ready
            ? "El entorno de AWS quedó preparado."
            : "AWS quedó preconfigurado; faltan credenciales o recursos del servidor.",
        );
      } else if (wizard === "email") {
        const saved = await persistConnection(emailDraft, "check");
        setEmailCheck(saved.providerCheck ?? null);
        setMessage(
          saved.providerCheck?.ok
            ? `Correo saliente conectado con Amazon SES. ${saved.providerCheck.detail}`
            : saved.providerCheck?.credentialsMissing
              ? `Configuración guardada. ${saved.providerCheck.detail}`
              : saved.providerCheck
                ? `SES rechazó la conexión: ${saved.providerCheck.detail}`
                : "El correo quedó preconfigurado; faltan las credenciales de SES en el servidor.",
        );
      } else {
        await saveIdentity();
        setMessage(
          "SSO/MFA quedó preconfigurado. La activación se hará al conectar el proveedor real.",
        );
      }
      setWizard(null);
    } catch (error) {
      setWizardError(
        error instanceof Error
          ? error.message
          : "No fue posible completar el asistente.",
      );
    } finally {
      setWizardSaving(false);
    }
  };

  const awsCompleted =
    ivsItem.evaluation.completed + s3Item.evaluation.completed;
  const awsTotal = ivsItem.evaluation.total + s3Item.evaluation.total;

  return (
    <>
      <header className="module-header integrations-header">
        <div>
          <p className="eyebrow">CONFIGURACIÓN</p>
          <h1>Integraciones</h1>
          <p>
            Prepara transmisión, almacenamiento e identidad mediante asistentes
            seguros y portables.
          </p>
        </div>
        <Link href="/events" className="secondary-action link-button">
          Ver eventos
        </Link>
      </header>

      {message && (
        <div className="detail-message" role="status">
          {message}
        </div>
      )}

      <div className="integration-summary">
        <article>
          <span>⌘</span>
          <div>
            <strong>{readyConnections}/4</strong>
            <p>servicios preparados</p>
          </div>
        </article>
        <article>
          <span>✓</span>
          <div>
            <strong>
              {completedRequirements}/{totalRequirements}
            </strong>
            <p>requisitos completos</p>
          </div>
        </article>
        <article>
          <span>◉</span>
          <div>
            <strong>{readySessionCount}</strong>
            <p>sesiones listas de {eventCount} eventos</p>
          </div>
        </article>
      </div>

      <section className="setup-wizard-section">
        <div className="integration-section-heading">
          <div>
            <p className="eyebrow">INICIO GUIADO</p>
            <h2>Asistentes de configuración</h2>
            <p>
              Completa primero los metadatos locales y después traslada los
              secretos al entorno de despliegue.
            </p>
          </div>
          <span>4 asistentes disponibles</span>
        </div>
        <div className="setup-wizard-grid">
          <article className="panel setup-wizard-card zoom-wizard-card">
            <header>
              <span className="service-logo zoom">zoom</span>
              <i className={zoomItem.connection.status}>
                {statusLabels[zoomItem.connection.status]}
              </i>
            </header>
            <p className="eyebrow">VIDEO Y REUNIONES</p>
            <h3>Zoom OAuth</h3>
            <p>
              Cuenta, callback y lista segura de variables para conectar al
              organizador.
            </p>
            <div className="wizard-card-progress">
              <span
                style={{
                  width: `${completionPercent(
                    zoomItem.evaluation.completed,
                    zoomItem.evaluation.total,
                  )}%`,
                }}
              />
            </div>
            <footer>
              <small>
                {zoomItem.evaluation.completed}/{zoomItem.evaluation.total}{" "}
                requisitos
              </small>
              <button onClick={() => openWizard("zoom")}>
                Abrir asistente →
              </button>
            </footer>
          </article>

          <article className="panel setup-wizard-card aws-wizard-card">
            <header>
              <span className="service-logo aws">aws</span>
              <i
                className={
                  ivsItem.evaluation.ready && s3Item.evaluation.ready
                    ? "configured"
                    : "pending"
                }
              >
                {ivsItem.evaluation.ready && s3Item.evaluation.ready
                  ? "Preparada"
                  : "Pendiente"}
              </i>
            </header>
            <p className="eyebrow">STREAMING Y GRABACIONES</p>
            <h3>Amazon IVS + S3</h3>
            <p>
              Región, canal, bucket y credenciales para llevar la señal a la
              audiencia.
            </p>
            <div className="wizard-card-progress">
              <span
                style={{
                  width: `${completionPercent(awsCompleted, awsTotal)}%`,
                }}
              />
            </div>
            <footer>
              <small>
                {awsCompleted}/{awsTotal} requisitos
              </small>
              <button onClick={() => openWizard("aws")}>
                Abrir asistente →
              </button>
            </footer>
          </article>

          <article className="panel setup-wizard-card identity-wizard-card">
            <header>
              <span className="identity-logo">ID</span>
              <i className={identity.settings.status}>
                {statusLabels[identity.settings.status]}
              </i>
            </header>
            <p className="eyebrow">ACCESO CORPORATIVO</p>
            <h3>SSO + MFA</h3>
            <p>
              OIDC/SAML, dominio permitido y política de segundo factor para el
              equipo.
            </p>
            <div className="wizard-card-progress">
              <span
                style={{
                  width: `${completionPercent(
                    identity.evaluation.completed,
                    identity.evaluation.total,
                  )}%`,
                }}
              />
            </div>
            <footer>
              <small>
                {canManageIdentity
                  ? `${identity.evaluation.completed}/${identity.evaluation.total} requisitos`
                  : "Solo administradores"}
              </small>
              <button
                disabled={!canManageIdentity}
                onClick={() => openWizard("identity")}
              >
                Abrir asistente →
              </button>
            </footer>
          </article>

          <article className="panel setup-wizard-card email-wizard-card">
            <header>
              <span className="service-logo aws">ses</span>
              <i className={emailItem.connection.status}>
                {statusLabels[emailItem.connection.status]}
              </i>
            </header>
            <p className="eyebrow">CORREO SALIENTE</p>
            <h3>Amazon SES</h3>
            <p>
              Remitente verificado y región para enviar confirmaciones,
              recordatorios e invitaciones.
            </p>
            <div className="wizard-card-progress">
              <span
                style={{
                  width: `${completionPercent(
                    emailItem.evaluation.completed,
                    emailItem.evaluation.total,
                  )}%`,
                }}
              />
            </div>
            <footer>
              <small>
                {emailItem.evaluation.completed}/{emailItem.evaluation.total}{" "}
                requisitos
              </small>
              <button onClick={() => openWizard("email")}>
                Abrir asistente →
              </button>
            </footer>
          </article>
          <ExtraIntegrationCards />
        </div>
      </section>


      <div className="integration-section-heading advanced-heading">
        <div>
          <p className="eyebrow">CONFIGURACIÓN AVANZADA</p>
          <h2>Servicios individuales</h2>
          <p>
            Ajusta directamente los metadatos cuando no necesites el recorrido
            guiado.
          </p>
        </div>
      </div>

      <div className="integration-config-list">
        {items.map((item) => {
          const content = providerContent[item.connection.provider];
          const saving = savingProvider === item.connection.provider;
          return (
            <article
              className="panel integration-config-card"
              key={item.connection.provider}
            >
              <header>
                <span className={`service-logo ${content.logo}`}>
                  {content.logo}
                </span>
                <div>
                  <p className="eyebrow">{content.eyebrow}</p>
                  <h2>{content.name}</h2>
                  <p>{content.description}</p>
                </div>
                <i className={item.connection.status}>
                  {statusLabels[item.connection.status]}
                </i>
              </header>
              <div className="integration-config-body">
                <div className="integration-requirements">
                  <div className="requirement-progress">
                    <span
                      style={{
                        width: `${completionPercent(
                          item.evaluation.completed,
                          item.evaluation.total,
                        )}%`,
                      }}
                    />
                  </div>
                  {item.evaluation.requirements.map((requirement) => (
                    <div key={requirement.key}>
                      <span className={requirement.ready ? "ready" : ""}>
                        {requirement.ready ? "✓" : "·"}
                      </span>
                      <p>
                        <b>{requirement.label}</b>
                        <small>
                          {requirement.source === "server"
                            ? "Variable segura del servidor"
                            : "Configuración guardada"}
                        </small>
                      </p>
                    </div>
                  ))}
                </div>
                <div className="integration-metadata-form">
                  <label>
                    Nombre interno
                    <input
                      maxLength={120}
                      placeholder={`Mi cuenta de ${content.name}`}
                      value={item.connection.accountLabel ?? ""}
                      onChange={(input) =>
                        updateConnection(item.connection.provider, {
                          accountLabel: input.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    {content.resourceLabel}
                    <input
                      maxLength={500}
                      placeholder={content.resourcePlaceholder}
                      value={item.connection.externalAccountId ?? ""}
                      onChange={(input) =>
                        updateConnection(item.connection.provider, {
                          externalAccountId: input.target.value || null,
                        })
                      }
                    />
                  </label>
                  {item.connection.provider !== "zoom" && (
                    <label>
                      Región
                      <input
                        maxLength={40}
                        placeholder={item.evaluation.runtime.region}
                        value={item.connection.region ?? ""}
                        onChange={(input) =>
                          updateConnection(item.connection.provider, {
                            region: input.target.value || null,
                          })
                        }
                      />
                    </label>
                  )}
                  <div className="integration-form-actions">
                    <p>
                      {item.connection.lastCheckedAt
                        ? `Revisada ${formatStableDateTime(
                            item.connection.lastCheckedAt,
                          )}`
                        : "Aún no se ha ejecutado una revisión local."}
                    </p>
                    <button
                      className="primary-button"
                      disabled={saving}
                      onClick={() => void saveConnection(item, "check")}
                    >
                      {saving ? "Revisando…" : "Guardar y revisar"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="panel identity-summary-card">
        <div>
          <span className="identity-logo">ID</span>
          <div>
            <p className="eyebrow">IDENTIDAD Y ACCESO</p>
            <h2>SSO {identity.settings.protocol.toUpperCase()} + MFA</h2>
            <p>
              {identity.settings.organizationDomain
                ? `Dominio: ${identity.settings.organizationDomain}`
                : "Dominio corporativo pendiente"}
              {" · "}
              {identity.settings.mfaPolicy === "required_all"
                ? "MFA para todo el equipo"
                : identity.settings.mfaPolicy === "required_admins"
                  ? "MFA para administradores"
                  : "MFA opcional"}
            </p>
          </div>
        </div>
        <div className="identity-summary-progress">
          <strong>
            {identity.evaluation.completed}/{identity.evaluation.total}
          </strong>
          <span>controles preparados</span>
        </div>
        <button
          className="secondary-action"
          disabled={!canManageIdentity}
          onClick={() => openWizard("identity")}
        >
          Revisar política
        </button>
      </section>


      {wizard && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !wizardSaving) {
              setWizard(null);
            }
          }}
        >
          <section
            className="modal setup-wizard-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-title"
          >
            <button
              className="modal-close"
              aria-label="Cerrar asistente"
              disabled={wizardSaving}
              onClick={() => setWizard(null)}
            >
              ×
            </button>
            <p className="eyebrow">{wizardContent[wizard].eyebrow}</p>
            <h2 id="wizard-title">{wizardContent[wizard].title}</h2>
            <p>{wizardContent[wizard].description}</p>

            <div
              className="wizard-stepper"
              aria-label={`Paso ${wizardStep + 1} de 4`}
            >
              {wizardContent[wizard].steps.map((step, index) => (
                <div
                  key={step}
                  className={
                    index === wizardStep
                      ? "active"
                      : index < wizardStep
                        ? "complete"
                        : ""
                  }
                >
                  <span>{index < wizardStep ? "✓" : index + 1}</span>
                  <small>{step}</small>
                </div>
              ))}
            </div>

            <div className="wizard-content">
              {wizard === "zoom" && wizardStep === 0 && (
                <div className="wizard-intro">
                  <div className="wizard-pipeline">
                    <span className="service-logo zoom">zoom</span>
                    <i>OAuth 2.0</i>
                    <span className="wizard-app-node">Icaza Live</span>
                    <i>reunión</i>
                    <span className="flow-audience">♙</span>
                  </div>
                  <h3>Flujo de autorización preparado</h3>
                  <p>
                    Cada organizador autorizará su cuenta. El servidor
                    conservará los tokens cifrados cuando se implemente la
                    conexión real.
                  </p>
                  <div className="wizard-callout">
                    <b>URL de retorno prevista</b>
                    <code>{zoomItem.evaluation.runtime.redirectUri}</code>
                  </div>
                </div>
              )}
              {wizard === "zoom" && wizardStep === 1 && (
                <div className="wizard-form-grid">
                  <label>
                    Nombre interno
                    <input
                      autoFocus
                      maxLength={120}
                      placeholder="Zoom corporativo"
                      value={zoomDraft.accountLabel ?? ""}
                      onChange={(event) =>
                        setZoomDraft({
                          ...zoomDraft,
                          accountLabel: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    ID de la cuenta
                    <input
                      maxLength={500}
                      placeholder="Opcional durante la preparación"
                      value={zoomDraft.externalAccountId ?? ""}
                      onChange={(event) =>
                        setZoomDraft({
                          ...zoomDraft,
                          externalAccountId: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <div className="wizard-callout wide">
                    <b>Scopes sugeridos para la app de Zoom</b>
                    <code>meeting:write · meeting:read · webinar:write</code>
                    <small>
                      Ajusta los scopes al mínimo necesario cuando se cree la
                      app OAuth.
                    </small>
                  </div>
                </div>
              )}
              {wizard === "zoom" && wizardStep === 2 && (
                <div>
                  <h3>Variables seguras de Zoom</h3>
                  <p className="wizard-helper">
                    El asistente solo comprueba su presencia; nunca recibe ni
                    muestra sus valores.
                  </p>
                  {requirementList(zoomItem.evaluation.requirements)}
                  <div className="wizard-callout">
                    <b>También prevista</b>
                    <code>ZOOM_WEBHOOK_SECRET</code>
                  </div>
                </div>
              )}
              {wizard === "zoom" && wizardStep === 3 && (
                <div className="wizard-review">
                  <span className="wizard-review-icon">Z</span>
                  <h3>Zoom quedará preconfigurado</h3>
                  <p>
                    Guardaremos <b>{zoomDraft.accountLabel || "Cuenta Zoom"}</b>{" "}
                    y comprobaremos las variables del servidor. No se creará
                    ninguna reunión real.
                  </p>
                  <dl>
                    <div>
                      <dt>Callback</dt>
                      <dd>{zoomItem.evaluation.runtime.redirectUri}</dd>
                    </div>
                    <div>
                      <dt>Secretos</dt>
                      <dd>Solo en el servidor</dd>
                    </div>
                  </dl>
                </div>
              )}

              {wizard === "aws" && wizardStep === 0 && (
                <div className="wizard-intro">
                  <div className="wizard-pipeline">
                    <span className="service-logo zoom">zoom</span>
                    <i>RTMP</i>
                    <span className="service-logo aws">IVS</span>
                    <i>playback</i>
                    <span className="flow-audience">♙</span>
                    <i>＋</i>
                    <span className="service-logo aws">S3</span>
                  </div>
                  <h3>Arquitectura de streaming preparada</h3>
                  <p>
                    IVS distribuirá la señal de baja latencia y S3 conservará
                    grabaciones y recursos posteriores.
                  </p>
                </div>
              )}
              {wizard === "aws" && wizardStep === 1 && (
                <div className="wizard-form-grid three">
                  <label>
                    Región
                    <input
                      autoFocus
                      maxLength={40}
                      placeholder={ivsItem.evaluation.runtime.region}
                      value={ivsDraft.region ?? ""}
                      onChange={(event) => {
                        const region = event.target.value || null;
                        setIvsDraft({ ...ivsDraft, region });
                        setS3Draft({ ...s3Draft, region });
                      }}
                    />
                  </label>
                  <label>
                    ARN del canal IVS
                    <input
                      maxLength={500}
                      placeholder="arn:aws:ivs:..."
                      value={ivsDraft.externalAccountId ?? ""}
                      onChange={(event) =>
                        setIvsDraft({
                          ...ivsDraft,
                          externalAccountId: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    Bucket de grabaciones
                    <input
                      maxLength={63}
                      placeholder="icaza-live-recordings"
                      value={s3Draft.externalAccountId ?? ""}
                      onChange={(event) =>
                        setS3Draft({
                          ...s3Draft,
                          externalAccountId: event.target.value || null,
                        })
                      }
                    />
                  </label>
                </div>
              )}
              {wizard === "aws" && wizardStep === 2 && (
                <div>
                  <h3>Credenciales y recursos del servidor</h3>
                  <p className="wizard-helper">
                    Usa un usuario o rol IAM con permisos mínimos para IVS y el
                    bucket seleccionado.
                  </p>
                  {requirementList([
                    ...ivsItem.evaluation.requirements,
                    ...s3Item.evaluation.requirements.filter(
                      (requirement) =>
                        !ivsItem.evaluation.requirements.some(
                          (current) => current.key === requirement.key,
                        ),
                    ),
                  ])}
                  <div className="wizard-callout">
                    <b>Política sugerida</b>
                    <code>ivs:*Channel · ivs:*StreamKey · s3:Put/GetObject</code>
                  </div>
                </div>
              )}
              {wizard === "aws" && wizardStep === 3 && (
                <div className="wizard-review">
                  <span className="wizard-review-icon aws-review">A</span>
                  <h3>AWS quedará preconfigurado</h3>
                  <p>
                    Guardaremos región y referencias de recursos. Las claves
                    IAM permanecerán fuera de la base de datos.
                  </p>
                  <dl>
                    <div>
                      <dt>Región</dt>
                      <dd>
                        {ivsDraft.region || ivsItem.evaluation.runtime.region}
                      </dd>
                    </div>
                    <div>
                      <dt>Bucket</dt>
                      <dd>{s3Draft.externalAccountId || "Pendiente"}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {wizard === "identity" && wizardStep === 0 && (
                <div className="wizard-form-grid">
                  <label>
                    Proveedor
                    <input
                      autoFocus
                      maxLength={120}
                      placeholder="Microsoft Entra ID, Okta…"
                      value={identityDraft.providerName ?? ""}
                      onChange={(event) =>
                        setIdentityDraft({
                          ...identityDraft,
                          providerName: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    Dominio corporativo
                    <input
                      maxLength={253}
                      placeholder="empresa.com"
                      value={identityDraft.organizationDomain ?? ""}
                      onChange={(event) =>
                        setIdentityDraft({
                          ...identityDraft,
                          organizationDomain: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <fieldset className="wizard-choice-group wide">
                    <legend>Protocolo de federación</legend>
                    <label
                      className={
                        identityDraft.protocol === "oidc" ? "selected" : ""
                      }
                    >
                      <input
                        type="radio"
                        name="identity-protocol"
                        checked={identityDraft.protocol === "oidc"}
                        onChange={() =>
                          setIdentityDraft({
                            ...identityDraft,
                            protocol: "oidc",
                          })
                        }
                      />
                      <span>
                        <b>OpenID Connect</b>
                        <small>Recomendado para implementaciones nuevas</small>
                      </span>
                    </label>
                    <label
                      className={
                        identityDraft.protocol === "saml" ? "selected" : ""
                      }
                    >
                      <input
                        type="radio"
                        name="identity-protocol"
                        checked={identityDraft.protocol === "saml"}
                        onChange={() =>
                          setIdentityDraft({
                            ...identityDraft,
                            protocol: "saml",
                          })
                        }
                      />
                      <span>
                        <b>SAML 2.0</b>
                        <small>Compatible con proveedores empresariales</small>
                      </span>
                    </label>
                  </fieldset>
                </div>
              )}
              {wizard === "identity" && wizardStep === 1 && (
                <div className="wizard-form-grid">
                  <label className="wide">
                    {identityDraft.protocol === "oidc"
                      ? "Issuer URL"
                      : "URL de metadata SAML"}
                    <input
                      autoFocus
                      maxLength={500}
                      placeholder="https://id.empresa.com/..."
                      value={identityDraft.issuerUrl ?? ""}
                      onChange={(event) =>
                        setIdentityDraft({
                          ...identityDraft,
                          issuerUrl: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  {identityDraft.protocol === "oidc" ? (
                    <label className="wide">
                      Client ID
                      <input
                        maxLength={500}
                        placeholder="Identificador público de la aplicación"
                        value={identityDraft.clientId ?? ""}
                        onChange={(event) =>
                          setIdentityDraft({
                            ...identityDraft,
                            clientId: event.target.value || null,
                          })
                        }
                      />
                    </label>
                  ) : (
                    <label className="wide">
                      Entity ID / Audience
                      <input
                        maxLength={500}
                        placeholder="urn:icaza-live"
                        value={identityDraft.entityId ?? ""}
                        onChange={(event) =>
                          setIdentityDraft({
                            ...identityDraft,
                            entityId: event.target.value || null,
                          })
                        }
                      />
                    </label>
                  )}
                  <div className="wizard-callout wide">
                    <b>Callback / ACS previsto</b>
                    <code>{identity.evaluation.runtime.callbackUrl}</code>
                  </div>
                </div>
              )}
              {wizard === "identity" && wizardStep === 2 && (
                <div className="wizard-form-grid">
                  <label>
                    Política MFA
                    <select
                      value={identityDraft.mfaPolicy}
                      onChange={(event) =>
                        setIdentityDraft({
                          ...identityDraft,
                          mfaPolicy: event.target.value as MfaPolicy,
                        })
                      }
                    >
                      <option value="required_admins">
                        Obligatorio para administradores
                      </option>
                      <option value="required_all">
                        Obligatorio para todo el equipo
                      </option>
                      <option value="optional">Opcional</option>
                    </select>
                  </label>
                  <label>
                    Método principal
                    <select
                      value={identityDraft.mfaMethod}
                      onChange={(event) =>
                        setIdentityDraft({
                          ...identityDraft,
                          mfaMethod: event.target.value as MfaMethod,
                        })
                      }
                    >
                      <option value="totp">App autenticadora (TOTP)</option>
                      <option value="webauthn">Llave de acceso (WebAuthn)</option>
                      <option value="email">Código por correo</option>
                    </select>
                  </label>
                  <label className="wizard-toggle wide">
                    <input
                      type="checkbox"
                      checked={identityDraft.recoveryCodesRequired}
                      onChange={(event) =>
                        setIdentityDraft({
                          ...identityDraft,
                          recoveryCodesRequired: event.target.checked,
                        })
                      }
                    />
                    <span>
                      <b>Exigir códigos de recuperación</b>
                      <small>
                        Se generarán al enrolar el segundo factor cuando MFA
                        esté implementado.
                      </small>
                    </span>
                  </label>
                  <div className="wizard-callout wide">
                    <b>Estado de esta etapa</b>
                    <span>
                      Política preconfigurada; no se forzará en el login local
                      hasta conectar el proveedor real.
                    </span>
                  </div>
                </div>
              )}
              {wizard === "identity" && wizardStep === 3 && (
                <div className="wizard-review">
                  <span className="wizard-review-icon identity-review">ID</span>
                  <h3>SSO/MFA quedará preconfigurado</h3>
                  <p>
                    Guardaremos únicamente configuración pública y política.
                    Certificados, secretos y claves de cifrado permanecerán en
                    el servidor.
                  </p>
                  {requirementList(identity.evaluation.requirements)}
                </div>
              )}

              {wizard === "email" && wizardStep === 0 && (
                <div className="wizard-intro">
                  <p>
                    Icaza Live envía confirmaciones de registro, recordatorios
                    e invitaciones. Amazon SES entrega esos correos con la
                    reputación y las métricas de AWS.
                  </p>
                  <div className="wizard-flow">
                    <div>
                      <b>1 · Cola local</b>
                      <small>
                        Cada registro genera su mensaje con el cuerpo ya
                        renderizado y su hora de envío.
                      </small>
                    </div>
                    <div>
                      <b>2 · Worker</b>
                      <small>
                        Procesa lo vencido y reintenta con espera creciente si
                        el envío falla.
                      </small>
                    </div>
                    <div>
                      <b>3 · Amazon SES</b>
                      <small>
                        Entrega el correo desde tu dominio verificado y reporta
                        el identificador del mensaje.
                      </small>
                    </div>
                  </div>
                  <p className="wizard-note">
                    Mientras SES no esté configurado, los correos se guardan en
                    el buzón local de vista previa: puedes revisar el contenido
                    exacto sin enviar nada al exterior.
                  </p>
                </div>
              )}

              {wizard === "email" && wizardStep === 1 && (
                <div className="wizard-form-grid email-form">
                  <label>
                    Remitente verificado en SES
                    <input
                      type="email"
                      value={emailDraft.accountLabel ?? ""}
                      placeholder="eventos@tudominio.com"
                      onChange={(input) =>
                        setEmailDraft((draft) => ({
                          ...draft,
                          accountLabel: input.target.value || null,
                        }))
                      }
                    />
                    <small>
                      Debe ser una dirección o dominio verificado en la consola
                      de SES; de lo contrario AWS rechaza el envío.
                    </small>
                  </label>
                  <label>
                    Región de SES
                    <input
                      value={emailDraft.region ?? ""}
                      placeholder="us-east-1"
                      onChange={(input) =>
                        setEmailDraft((draft) => ({
                          ...draft,
                          region: input.target.value || null,
                        }))
                      }
                    />
                    <small>
                      Usa la región donde verificaste el dominio. La identidad
                      no se comparte entre regiones.
                    </small>
                  </label>
                  <label>
                    Conjunto de configuración (opcional)
                    <input
                      value={emailDraft.externalAccountId ?? ""}
                      placeholder="icaza-live-eventos"
                      onChange={(input) =>
                        setEmailDraft((draft) => ({
                          ...draft,
                          externalAccountId: input.target.value || null,
                        }))
                      }
                    />
                    <small>
                      Permite seguir aperturas, rebotes y quejas desde AWS.
                    </small>
                  </label>
                </div>
              )}

              {wizard === "email" && wizardStep === 2 && (
                <div className="wizard-secrets">
                  <p>
                    Estas variables van en el archivo <code>.env</code> local o
                    en los Secrets del despliegue. Nunca se guardan en la base
                    de datos ni se muestran en la interfaz.
                  </p>
                  <div className="wizard-secret-list">
                    <div>
                      <code>AWS_SES_ACCESS_KEY_ID</code>
                      <small>Clave de un usuario IAM con permiso ses:SendEmail</small>
                    </div>
                    <div>
                      <code>AWS_SES_SECRET_ACCESS_KEY</code>
                      <small>Secreto asociado a esa clave</small>
                    </div>
                    <div>
                      <code>AWS_SES_REGION</code>
                      <small>
                        {emailDraft.region
                          ? `Debe coincidir con ${emailDraft.region}`
                          : "Región donde verificaste el remitente"}
                      </small>
                    </div>
                    <div>
                      <code>EMAIL_FROM</code>
                      <small>
                        {emailDraft.accountLabel
                          ? `Debe coincidir con ${emailDraft.accountLabel}`
                          : "Dirección del remitente verificado"}
                      </small>
                    </div>
                    <div>
                      <code>EMAIL_REPLY_TO</code>
                      <small>Opcional: dirección para las respuestas</small>
                    </div>
                  </div>
                  <p className="wizard-note">
                    Concede al usuario IAM únicamente <code>ses:SendEmail</code>{" "}
                    y <code>ses:GetAccount</code>. Evita usar credenciales de
                    administrador.
                  </p>
                </div>
              )}

              {wizard === "email" && wizardStep === 3 && (
                <div className="wizard-review">
                  <span className="wizard-review-icon email-review">✉</span>
                  <h3>Verificar la conexión con SES</h3>
                  <p>
                    Al finalizar, la plataforma consultará tu cuenta de SES con
                    las credenciales del servidor para confirmar el acceso y
                    detectar si la cuenta sigue en modo prueba (sandbox).
                  </p>
                  {requirementList(emailItem.evaluation.requirements)}
                  {emailCheck && (
                    <p
                      className={`wizard-note ${emailCheck.ok ? "ok" : "warning"}`}
                      role="status"
                    >
                      {emailCheck.ok ? "✓ " : "⚠ "}
                      {emailCheck.detail}
                      {emailCheck.quota
                        ? ` Cuota diaria: ${emailCheck.quota.toLocaleString("es-CO")} correos.`
                        : ""}
                    </p>
                  )}
                  <div className="wizard-field" style={{ marginTop: 18 }}>
                    <label htmlFor="test-email-to">
                      Enviar correo de prueba
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="test-email-to"
                        type="email"
                        placeholder="destinatario@empresa.com"
                        value={testEmailTo}
                        onChange={(event) => setTestEmailTo(event.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="primary-button"
                        disabled={testEmailSending || !testEmailTo.trim()}
                        onClick={() => void sendTestEmail()}
                      >
                        {testEmailSending ? "Enviando…" : "Enviar prueba"}
                      </button>
                    </div>
                    <small>
                      Envía un mensaje real con el proveedor activo. En modo
                      prueba (sandbox), el destinatario debe estar verificado en
                      SES.
                    </small>
                    {testEmailResult && (
                      <p
                        className={`wizard-note ${testEmailResult.ok ? "ok" : "warning"}`}
                        role="status"
                      >
                        {testEmailResult.ok ? "✓ " : "⚠ "}
                        {testEmailResult.detail}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {wizardError && (
              <div className="wizard-error" role="alert">
                ⓘ {wizardError}
              </div>
            )}
            <footer className="wizard-actions">
              <button
                className="wizard-back"
                disabled={wizardStep === 0 || wizardSaving}
                onClick={() => setWizardStep((step) => step - 1)}
              >
                ← Anterior
              </button>
              <span>
                Paso {wizardStep + 1} de {wizardContent[wizard].steps.length}
              </span>
              {wizardStep < wizardContent[wizard].steps.length - 1 ? (
                <button
                  className="primary-button"
                  onClick={() => setWizardStep((step) => step + 1)}
                >
                  Continuar →
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={wizardSaving}
                  onClick={() => void completeWizard()}
                >
                  {wizardSaving ? "Guardando…" : "Guardar preconfiguración"}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
