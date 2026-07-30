import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  consentRecords,
  dataSubjectRequests,
  events,
  legalDocuments,
} from "@/db/schema";

export type LegalDocumentKind = "privacy" | "terms";

export type PublishedLegalDocument = {
  id: string;
  type: LegalDocumentKind;
  version: number;
  title: string;
  summary: string;
  content: string;
  publishedAt: Date | null;
};

const DEFAULT_LEGAL_DOCUMENTS: Record<
  LegalDocumentKind,
  Pick<PublishedLegalDocument, "title" | "summary" | "content">
> = {
  privacy: {
    title: "Política de privacidad y tratamiento de datos",
    summary:
      "Explica qué datos usa Icaza Live, para qué los necesita y cómo ejercer tus derechos.",
    content:
      "Responsable y alcance\n\nIcaza Live trata los datos proporcionados durante el registro, la participación en eventos y las solicitudes de soporte para operar la plataforma y prestar el servicio solicitado.\n\nDatos y finalidades\n\nRecopilamos únicamente datos de identificación y contacto, información profesional opcional, evidencia de consentimiento y actividad necesaria para entregar el evento, proteger el acceso y generar analítica operativa. El consentimiento de marketing es independiente y opcional.\n\nConservación y seguridad\n\nLos datos se conservan durante el tiempo necesario para prestar el servicio, cumplir obligaciones legales y resolver solicitudes. Se aplican controles de acceso por rol, trazabilidad y minimización. En producción, las transmisiones deben protegerse mediante TLS y la base de datos mediante las capacidades de cifrado del proveedor.\n\nTus derechos\n\nPuedes solicitar acceso, corrección, portabilidad, restricción o eliminación. Verificaremos tu identidad antes de entregar o eliminar información y responderemos dentro del plazo indicado en este centro de privacidad.\n\nContacto\n\nUtiliza el formulario de derechos de datos de esta página. No incluyas contraseñas, tokens, documentos completos ni otra información sensible que no sea necesaria.",
  },
  terms: {
    title: "Términos de uso",
    summary:
      "Condiciones aplicables al registro, acceso y participación en eventos de Icaza Live.",
    content:
      "Uso permitido\n\nLa plataforma se ofrece para crear, administrar y participar en eventos digitales e híbridos. Debes proporcionar información válida y utilizar enlaces de acceso únicamente para el propósito y la persona a quienes fueron emitidos.\n\nResponsabilidad de acceso\n\nNo compartas contraseñas, tokens, enlaces privados ni credenciales de integraciones. Las acciones administrativas quedan sujetas a permisos y registro de auditoría.\n\nContenido y conducta\n\nNo publiques material ilegal, malicioso o que vulnere derechos de terceros. Los organizadores pueden moderar contenido e interacción para proteger la experiencia del evento.\n\nDisponibilidad\n\nDurante la etapa local, la plataforma y las integraciones externas funcionan como preconfiguración. Los niveles de servicio, soporte, continuidad y disponibilidad productiva se definirán al desplegar la infraestructura.\n\nCambios\n\nCada publicación genera una versión identificable. El registro conserva la versión aceptada para demostrar el consentimiento aplicable en ese momento.",
  },
};

async function ensureDefaultLegalDocuments() {
  const db = getDb();
  const published = await db
    .select({ type: legalDocuments.type })
    .from(legalDocuments)
    .where(eq(legalDocuments.status, "published"));
  const existing = new Set(published.map((document) => document.type));

  for (const type of ["privacy", "terms"] as const) {
    if (existing.has(type)) continue;
    const [latest] = await db
      .select({ version: legalDocuments.version })
      .from(legalDocuments)
      .where(eq(legalDocuments.type, type))
      .orderBy(desc(legalDocuments.version))
      .limit(1);
    const defaults = DEFAULT_LEGAL_DOCUMENTS[type];
    await db
      .insert(legalDocuments)
      .values({
        type,
        version: (latest?.version ?? 0) + 1,
        ...defaults,
        status: "published",
        publishedAt: new Date(),
      })
      .onConflictDoNothing();
  }
}

export async function getPublishedLegalDocuments(): Promise<{
  privacy: PublishedLegalDocument;
  terms: PublishedLegalDocument;
}> {
  await ensureDefaultLegalDocuments();
  const publishedRecords = await getDb()
    .select({
      id: legalDocuments.id,
      type: legalDocuments.type,
      version: legalDocuments.version,
      title: legalDocuments.title,
      summary: legalDocuments.summary,
      content: legalDocuments.content,
      publishedAt: legalDocuments.publishedAt,
    })
    .from(legalDocuments)
    .where(eq(legalDocuments.status, "published"))
    .orderBy(desc(legalDocuments.version));
  const activePrivacy = publishedRecords.find(
    (document) => document.type === "privacy",
  );
  const activeTerms = publishedRecords.find(
    (document) => document.type === "terms",
  );
  if (!activePrivacy || !activeTerms) {
    throw new Error("Faltan documentos legales publicados.");
  }
  return { privacy: activePrivacy, terms: activeTerms };
}

export async function getPrivacyAdminData() {
  await ensureDefaultLegalDocuments();
  const db = getDb();
  const [documents, requests, consents] = await Promise.all([
    db
      .select()
      .from(legalDocuments)
      .orderBy(legalDocuments.type, desc(legalDocuments.version)),
    db
      .select()
      .from(dataSubjectRequests)
      .orderBy(desc(dataSubjectRequests.createdAt))
      .limit(100),
    db
      .select({
        id: consentRecords.id,
        eventId: consentRecords.eventId,
        eventTitle: events.title,
        registrationId: consentRecords.registrationId,
        privacyVersion: consentRecords.privacyVersion,
        termsVersion: consentRecords.termsVersion,
        subjectEmailHash: consentRecords.subjectEmailHash,
        marketingAccepted: consentRecords.marketingAccepted,
        ipAddress: consentRecords.ipAddress,
        acceptedAt: consentRecords.acceptedAt,
      })
      .from(consentRecords)
      .leftJoin(events, eq(consentRecords.eventId, events.id))
      .orderBy(desc(consentRecords.acceptedAt))
      .limit(100),
  ]);
  return { documents, requests, consents };
}
