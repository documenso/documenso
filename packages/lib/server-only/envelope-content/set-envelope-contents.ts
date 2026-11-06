import type { EnvelopeContentType, TEnvelopeContentMetaInput } from '@documenso/lib/types/envelope-content-meta';
import { CONTENT_TYPE_DATA_CONTENT_TYPE, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { prisma } from '@documenso/prisma';
import { type DataContent, EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { generateDatabaseId } from '../../universal/id';
import type { CreateDocumentAuditLogDataResponse } from '../../utils/document-audit-logs';
import { createDocumentAuditLogData, diffContentChanges } from '../../utils/document-audit-logs';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { assertEnvelopeContentSaveWithinLimits } from '../../utils/envelope-content';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { assertContentCanBeChanged } from './assert-content-can-be-changed';

export type SetEnvelopeContentsOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  contents: {
    id?: string | null;
    formId?: string;
    envelopeItemId: string;

    contentMeta: TEnvelopeContentMetaInput;

    /**
     * Must already be attached to this envelope, or null to remove the image.
     * Only here so a data content can be duplicated without reuploading it; new
     * images go through `trpc.envelope.content.uploadImage` or `newDataContents`.
     */
    dataContentId: string | null;
  }[];

  /**
   * Never pass data content IDs taken from a request here, since these are
   * attached without checking where they came from.
   */
  newDataContents?: Pick<DataContent, 'id' | 'metadata'>[];

  requestMetadata: ApiRequestMetadata;
};

export const setEnvelopeContents = async ({
  userId,
  teamId,
  id,
  contents,
  newDataContents = [],
  requestMetadata,
}: SetEnvelopeContentsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: null,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      envelopeItems: {
        select: {
          id: true,
        },
      },
      contents: {
        include: {
          dataContent: {
            select: {
              id: true,
              metadata: true,
            },
          },
        },
      },
      team: {
        select: {
          organisation: {
            select: {
              organisationClaim: {
                select: {
                  envelopeContentCount: true,
                  envelopeContentImageCount: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  await assertContentCanBeChanged(envelope);

  const existingContents = envelope.contents.map(({ dataContent: _dataContent, ...content }) => content);

  const attachedDataContents = new Map([
    ...envelope.contents.flatMap((content) =>
      content.dataContent ? [[content.dataContent.id, content.dataContent] as const] : [],
    ),
    ...newDataContents.map((dataContent) => [dataContent.id, dataContent] as const),
  ]);

  assertEnvelopeContentSaveWithinLimits({
    incomingTypes: contents.map((content) => ZEnvelopeContentMetaSchema.parse(content.contentMeta).type),
    existingTypes: existingContents.map((content) => content.contentMeta.type),
    claim: envelope.team.organisation.organisationClaim,
  });

  const removedContents = existingContents.filter(
    (existingContent) => !contents.some((content) => content.id === existingContent.id),
  );

  const linkedContents = contents.map((content) => {
    const foundEnvelopeItem = envelope.envelopeItems.find((envelopeItem) => envelopeItem.id === content.envelopeItemId);

    if (!foundEnvelopeItem) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Envelope item ${content.envelopeItemId} not found`,
      });
    }

    const contentMeta = ZEnvelopeContentMetaSchema.parse(content.contentMeta);

    // An ID from another envelope is treated as a new content, not an update.
    const persisted = existingContents.find((existingContent) => existingContent.id === content.id);

    // Nothing in the editor moves contents between items, and allowing it here
    // would let a move slip through without an audit log since the diff only
    // covers the content meta and attached image.
    if (persisted && persisted.envelopeItemId !== content.envelopeItemId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Content ${persisted.id} cannot be moved to a different envelope item`,
      });
    }

    return {
      ...content,
      contentMeta,
      dataContentId: resolveDataContentId(content.dataContentId, contentMeta.type, attachedDataContents),
      _persisted: persisted,
    };
  });

  const isAuditLogRequired = envelope.type === EnvelopeType.DOCUMENT;

  const persistedContents = await prisma.$transaction(async (tx) => {
    // The envelope may have been sent since it was read above, in which case
    // its contents have already been rendered into the PDF and must not change.
    await assertContentCanBeChanged(envelope, tx);

    const auditLogs: CreateDocumentAuditLogDataResponse[] = [];

    if (removedContents.length > 0) {
      await tx.envelopeContent.deleteMany({
        where: {
          id: {
            in: removedContents.map((content) => content.id),
          },
          envelopeId: envelope.id,
        },
      });

      if (isAuditLogRequired) {
        auditLogs.push(
          ...removedContents.map((content) =>
            createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.CONTENT_DELETED,
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                contentId: content.id,
                contentType: content.contentMeta.type,
                envelopeItemId: content.envelopeItemId,
              },
            }),
          ),
        );
      }
    }

    const upsertResults = await Promise.all(
      linkedContents.map(async (content) => {
        const { dataContentId } = content;

        if (content._persisted) {
          // The editor sends every content on every save, so unchanged contents
          // are neither written nor logged.
          const changes = diffContentChanges(content._persisted, {
            contentMeta: content.contentMeta,
            dataContentId,
          });

          if (changes.length === 0) {
            return {
              content: {
                ...content._persisted,
                formId: content.formId,
              },
              auditLog: null,
            };
          }

          const updatedContent = await tx.envelopeContent.update({
            where: {
              id: content._persisted.id,
            },
            data: {
              contentMeta: content.contentMeta,
              dataContentId,
            },
          });

          let auditLog: CreateDocumentAuditLogDataResponse | null = null;

          if (isAuditLogRequired) {
            auditLog = createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.CONTENT_UPDATED,
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                contentId: updatedContent.id,
                contentType: updatedContent.contentMeta.type,
                envelopeItemId: updatedContent.envelopeItemId,
                changes,
              },
            });
          }

          return {
            content: {
              ...updatedContent,
              formId: content.formId,
            },
            auditLog,
          };
        }

        const createdContent = await tx.envelopeContent.create({
          data: {
            id: generateDatabaseId('envelope_content'),
            envelopeId: envelope.id,
            envelopeItemId: content.envelopeItemId,
            contentMeta: content.contentMeta,
            dataContentId,
          },
        });

        let auditLog: CreateDocumentAuditLogDataResponse | null = null;

        if (isAuditLogRequired) {
          auditLog = createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.CONTENT_CREATED,
            envelopeId: envelope.id,
            metadata: requestMetadata,
            data: {
              contentId: createdContent.id,
              contentType: createdContent.contentMeta.type,
              envelopeItemId: createdContent.envelopeItemId,
              contentMeta: createdContent.contentMeta,
              dataContentId: createdContent.dataContentId,
            },
          });
        }

        return {
          content: {
            ...createdContent,
            formId: content.formId,
          },
          auditLog,
        };
      }),
    );

    const upsertedContents = upsertResults.map((result) => result.content);

    auditLogs.push(...upsertResults.flatMap((result) => (result.auditLog ? [result.auditLog] : [])));

    // Data contents are never deleted: one a content stops referencing may still
    // be referenced by another (e.g. a document created from the same template).

    if (auditLogs.length > 0) {
      await tx.documentAuditLog.createMany({
        data: auditLogs,
      });
    }

    return upsertedContents;
  });

  return {
    contents: persistedContents,
  };
};

/**
 * Deliberately reports an unattached data content as not found rather than
 * forbidden, so the response does not reveal whether the ID exists.
 */
const resolveDataContentId = (
  dataContentId: string | null | undefined,
  contentType: EnvelopeContentType,
  attachedDataContents: Map<string, Pick<DataContent, 'id' | 'metadata'>>,
) => {
  if (!dataContentId) {
    return null;
  }

  const dataContent = attachedDataContents.get(dataContentId);

  if (!dataContent) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Data content ${dataContentId} not found`,
    });
  }

  const expectedDataContentType = CONTENT_TYPE_DATA_CONTENT_TYPE[contentType];

  if (!expectedDataContentType || dataContent.metadata.type !== expectedDataContentType) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Data content ${dataContent.id} (${dataContent.metadata.type}) cannot be used by a ${contentType} content`,
    });
  }

  return dataContent.id;
};
