import { prisma } from '@documenso/prisma';
import { DocumentSource, EnvelopeType, WebhookTriggerEvents } from '@prisma/client';
import pMap from 'p-map';
import { omit } from 'remeda';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { ZSignatureLevelSchema } from '../../types/signature-level';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { nanoid, prefixedId } from '../../universal/id';
import type { CreateDocumentAuditLogDataResponse } from '../../utils/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { buildEnvelopeContentCopyData } from '../../utils/envelope-content';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { incrementDocumentId, incrementTemplateId } from '../envelope/increment-id';
import { assertOrganisationRatesAndLimits } from '../rate-limit/assert-organisation-rates-and-limits';
import { resolveSignatureLevel } from '../signature-level/resolve-signature-level';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export interface DuplicateEnvelopeOptions {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  requestMetadata: ApiRequestMetadata;
  overrides?: {
    duplicateAsTemplate?: boolean;
    includeRecipients?: boolean;
    includeFields?: boolean;
    includeContents?: boolean;
  };
}

export const duplicateEnvelope = async ({
  id,
  userId,
  teamId,
  requestMetadata,
  overrides,
}: DuplicateEnvelopeOptions) => {
  const {
    duplicateAsTemplate = false,
    includeRecipients = true,
    includeFields = true,
    includeContents = true,
  } = overrides ?? {};

  const { envelopeWhereInput, team } = await getEnvelopeWhereInput({
    id,
    type: null,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    select: {
      id: true,
      type: true,
      title: true,
      userId: true,
      internalVersion: true,
      signatureLevel: true,
      templateType: true,
      publicTitle: true,
      publicDescription: true,
      envelopeItems: {
        include: {
          documentData: {
            select: {
              data: true,
              initialData: true,
              type: true,
            },
          },
        },
      },
      authOptions: true,
      visibility: true,
      documentMeta: true,
      contents: true,
      recipients: {
        select: {
          email: true,
          name: true,
          role: true,
          signingOrder: true,
          fields: true,
        },
      },
      teamId: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (duplicateAsTemplate && envelope.type !== EnvelopeType.DOCUMENT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only documents can be saved as templates',
    });
  }

  const targetType = duplicateAsTemplate ? EnvelopeType.TEMPLATE : envelope.type;

  // Enforce the organisation document-creation limit before creating the duplicate.
  if (targetType === EnvelopeType.DOCUMENT) {
    await assertOrganisationRatesAndLimits({
      organisationId: team.organisationId,
      type: 'document',
      count: 1,
    });
  }

  const [{ legacyNumberId, secondaryId }, createdDocumentMeta] = await Promise.all([
    targetType === EnvelopeType.DOCUMENT
      ? incrementDocumentId().then(({ documentId, formattedDocumentId }) => ({
          legacyNumberId: documentId,
          secondaryId: formattedDocumentId,
        }))
      : incrementTemplateId().then(({ templateId, formattedTemplateId }) => ({
          legacyNumberId: templateId,
          secondaryId: formattedTemplateId,
        })),
    prisma.documentMeta.create({
      data: {
        ...omit(envelope.documentMeta, ['id']),
        emailSettings: envelope.documentMeta.emailSettings || undefined,
      },
    }),
  ]);

  const duplicatedTemplateType =
    envelope.templateType === 'ORGANISATION' && envelope.teamId !== teamId
      ? 'PRIVATE'
      : (envelope.templateType ?? undefined);

  // The source level is a free-form TEXT column — parse defensively before
  // handing to the resolver. Coerce (not strict) because instance mode may have
  // changed since the source envelope was created.
  const duplicatedSignatureLevel = resolveSignatureLevel({
    requested: ZSignatureLevelSchema.parse(envelope.signatureLevel),
    strict: false,
  });

  const duplicatedEnvelope = await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId,
      type: targetType,
      internalVersion: envelope.internalVersion,
      signatureLevel: duplicatedSignatureLevel,
      userId,
      teamId,
      title: `${envelope.title} (copy)`,
      documentMetaId: createdDocumentMeta.id,
      authOptions: envelope.authOptions || undefined,
      visibility: envelope.visibility,
      templateType: duplicatedTemplateType,
      publicTitle: envelope.publicTitle ?? undefined,
      publicDescription: envelope.publicDescription ?? undefined,
      source: targetType === EnvelopeType.DOCUMENT ? DocumentSource.DOCUMENT : DocumentSource.TEMPLATE,
    },
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  // Key = original envelope item ID
  // Value = duplicated envelope item ID.
  const oldEnvelopeItemToNewEnvelopeItemIdMap: Record<string, string> = {};

  // Duplicate the envelope items.
  await Promise.all(
    envelope.envelopeItems.map(async (envelopeItem) => {
      const duplicatedDocumentData = await prisma.documentData.create({
        data: {
          type: envelopeItem.documentData.type,
          data: envelopeItem.documentData.initialData,
          initialData: envelopeItem.documentData.initialData,
        },
      });

      const duplicatedEnvelopeItem = await prisma.envelopeItem.create({
        data: {
          id: prefixedId('envelope_item'),
          title: envelopeItem.title,
          order: envelopeItem.order,
          envelopeId: duplicatedEnvelope.id,
          documentDataId: duplicatedDocumentData.id,
        },
      });

      oldEnvelopeItemToNewEnvelopeItemIdMap[envelopeItem.id] = duplicatedEnvelopeItem.id;
    }),
  );

  const auditLogs: CreateDocumentAuditLogDataResponse[] = [];

  const isAuditLogRequired = duplicatedEnvelope.type === EnvelopeType.DOCUMENT;

  if (isAuditLogRequired) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        envelopeId: duplicatedEnvelope.id,
        metadata: requestMetadata,
        data: {
          title: duplicatedEnvelope.title,
          source: {
            type: DocumentSource.DOCUMENT,
          },
        },
      }),
    );
  }

  if (includeRecipients) {
    const duplicatedRecipients = await pMap(
      envelope.recipients,
      async (recipient) =>
        prisma.recipient.create({
          include: {
            fields: true,
          },
          data: {
            envelopeId: duplicatedEnvelope.id,
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
            fields: includeFields
              ? {
                  createMany: {
                    data: recipient.fields.map((field) => ({
                      envelopeId: duplicatedEnvelope.id,
                      envelopeItemId: oldEnvelopeItemToNewEnvelopeItemIdMap[field.envelopeItemId],
                      type: field.type,
                      page: field.page,
                      positionX: field.positionX,
                      positionY: field.positionY,
                      width: field.width,
                      height: field.height,
                      customText: '',
                      inserted: false,
                      fieldMeta: field.fieldMeta as PrismaJson.FieldMeta,
                    })),
                  },
                }
              : undefined,
          },
        }),
      { concurrency: 5 },
    );

    if (isAuditLogRequired) {
      const fieldAuditLogs = duplicatedRecipients.flatMap((recipient) =>
        recipient.fields.map((field) =>
          createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
            envelopeId: duplicatedEnvelope.id,
            metadata: requestMetadata,
            data: {
              fieldId: field.secondaryId,
              fieldRecipientEmail: recipient.email,
              fieldRecipientId: recipient.id,
              fieldType: field.type,
            },
          }),
        ),
      );

      auditLogs.push(...fieldAuditLogs);
    }
  }

  if (includeContents) {
    const contentsToCreate = buildEnvelopeContentCopyData({
      contents: envelope.contents,
      envelopeId: duplicatedEnvelope.id,
      envelopeItemIdMap: oldEnvelopeItemToNewEnvelopeItemIdMap,
    });

    if (contentsToCreate.length > 0) {
      await prisma.envelopeContent.createMany({
        data: contentsToCreate,
      });
    }

    if (isAuditLogRequired) {
      const contentsAuditLogs = contentsToCreate.map((content) =>
        createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.CONTENT_CREATED,
          envelopeId: duplicatedEnvelope.id,
          metadata: requestMetadata,
          data: {
            contentId: content.id,
            contentType: content.contentMeta.type,
            envelopeItemId: content.envelopeItemId,
            contentMeta: content.contentMeta,
            dataContentId: content.dataContentId ?? null,
          },
        }),
      );

      auditLogs.push(...contentsAuditLogs);
    }
  }

  if (auditLogs.length > 0) {
    await prisma.documentAuditLog.createMany({
      data: auditLogs,
    });
  }

  if (duplicatedEnvelope.type === EnvelopeType.DOCUMENT) {
    const refetchedEnvelope = await prisma.envelope.findFirstOrThrow({
      where: {
        id: duplicatedEnvelope.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(refetchedEnvelope)),
      userId: userId,
      teamId: teamId,
    });
  }

  return {
    id: duplicatedEnvelope.id,
    envelope: duplicatedEnvelope,
    legacyId: {
      type: duplicatedEnvelope.type,
      id: legacyNumberId,
    },
  };
};
