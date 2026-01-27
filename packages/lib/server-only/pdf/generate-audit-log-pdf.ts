import { PDF } from '@libpdf/core';
import { i18n } from '@lingui/core';

import { prisma } from '@documenso/prisma';

import { ZSupportedLanguageCodeSchema } from '../../constants/i18n';
import { parseDocumentAuditLogData } from '../../utils/document-audit-logs';
import { getTranslations } from '../../utils/i18n';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import type { GenerateCertificatePdfOptions } from './generate-certificate-pdf';
import { renderAuditLogs } from './render-audit-logs';

type GenerateAuditLogPdfOptions = GenerateCertificatePdfOptions & {
  envelopeItems: string[];
};

export const generateAuditLogPdf = async (options: GenerateAuditLogPdfOptions) => {
  const { envelope, envelopeOwner, envelopeItems, recipients, language, pageWidth, pageHeight } =
    options;

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(language);

  const [organisationClaim, auditLogs, messages] = await Promise.all([
    getOrganisationClaimByTeamId({ teamId: envelope.teamId }),
    getAuditLogs(envelope.id),
    getTranslations(documentLanguage),
  ]);

  i18n.loadAndActivate({
    locale: documentLanguage,
    messages,
  });

  const auditLogPages = await renderAuditLogs({
    envelope,
    envelopeOwner,
    envelopeItems,
    recipients,
    auditLogs,
    hidePoweredBy: organisationClaim.flags.hidePoweredBy ?? false,
    pageWidth,
    pageHeight,
    i18n,
  });

  return await PDF.merge(auditLogPages, {
    includeAnnotations: true,
  });
};

const getAuditLogs = async (envelopeId: string) => {
  const auditLogs = await prisma.documentAuditLog.findMany({
    where: {
      envelopeId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return auditLogs.map((auditLog) => parseDocumentAuditLogData(auditLog));
};
