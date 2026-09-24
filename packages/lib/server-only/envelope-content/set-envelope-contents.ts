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
import { canContentBeChanged, type EnvelopeIdOptions } from '../../utils/envelope';
import { assertEnvelopeContentSaveWithinLimits, getDataContentIds } from '../../utils/envelope-content';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type SetEnvelopeContentsOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  contents: {
    /**
     * The ID of an existing content to update. Omit to create a new content.
     */
    id?: string | null;

    /**
     * A temporary client side ID, echoed back so the client can map newly
     * created contents to their local counterparts.
     */
    formId?: string;

    /**
     * The envelope item the content is placed on. Fixed once the content is
     * created: an update must send the item the content already belongs to.
     */
    envelopeItemId: string;

    contentMeta: TEnvelopeContentMetaInput;

    /**
     * The ID of an uploaded data content (e.g. an image) to attach to the
     * content, or null for none.
     */
    dataContentId: string | null;
  }[];
  requestMetadata: ApiRequestMetadata;
};

/**
 * Replace the contents of an envelope with the given list.
 *
 * Existing contents not present in the list are deleted, contents with a
 * matching ID are updated, and the rest are created.
 *
 * Data contents referenced by the list are attached. They are shared rather
 * than copied, and never deleted once no longer referenced.
 */
export const setEnvelopeContents = async ({
  userId,
  teamId,
  id,
  contents,
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
      contents: true,
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

  // Contents are part of the authored document, so they follow the same
  // rules as the file itself (frozen once sent, always editable on templates).
  if (!canContentBeChanged(envelope)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Contents can no longer be modified for this envelope',
    });
  }

  const existingContents = envelope.contents;

  // The organisation's plan caps how much content an envelope may hold.
  assertEnvelopeContentSaveWithinLimits({
    incomingTypes: contents.map((content) => ZEnvelopeContentMetaSchema.parse(content.contentMeta).type),
    existingTypes: existingContents.map((content) => content.contentMeta.type),
    claim: envelope.team.organisation.organisationClaim,
  });

  const removedContents = existingContents.filter(
    (existingContent) => !contents.some((content) => content.id === existingContent.id),
  );

  const requestedDataContentIds = getDataContentIds(contents);

  // A data content is an immutable blob which any number of contents may point
  // at, so it is shared rather than copied. Knowing its ID is all that is
  // needed to attach it: the IDs are random and unguessable, and attaching one
  // only lets its bytes be displayed, so there is no ownership check.
  let requestedDataContents: DataContent[] = [];

  // Verify that the data contents exist.
  if (requestedDataContentIds.length > 0) {
    requestedDataContents = await prisma.dataContent.findMany({
      where: {
        id: {
          in: requestedDataContentIds,
        },
      },
    });
  }

  const linkedContents = contents.map((content) => {
    const foundEnvelopeItem = envelope.envelopeItems.find((envelopeItem) => envelopeItem.id === content.envelopeItemId);

    if (!foundEnvelopeItem) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Envelope item ${content.envelopeItemId} not found`,
      });
    }

    const contentMeta = ZEnvelopeContentMetaSchema.parse(content.contentMeta);

    // Only treat the content as existing if it actually belongs to this
    // envelope, otherwise a new content is created.
    const persisted = existingContents.find((existingContent) => existingContent.id === content.id);

    // A content stays on the item it was created on. Nothing in the editor
    // moves contents between items, and allowing it here would let a move
    // slip through without an audit log since the diff only covers the
    // content meta and attached image.
    if (persisted && persisted.envelopeItemId !== content.envelopeItemId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Content ${persisted.id} cannot be moved to a different envelope item`,
      });
    }

    return {
      ...content,
      contentMeta,
      dataContentId: resolveDataContentId(content.dataContentId, contentMeta.type, requestedDataContents),
      _persisted: persisted,
    };
  });

  const isAuditLogRequired = envelope.type === EnvelopeType.DOCUMENT;

  const persistedContents = await prisma.$transaction(async (tx) => {
    // Collected as the contents are written and inserted in one go at the end
    // of the transaction, rather than a round trip per content.
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

        // Handle updating an existing content.
        if (content._persisted) {
          // The editor sends every content on every save, so the row is only
          // written (and the update only logged) when something about the
          // content actually changed.
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

        // Handle creating a new content.
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

    // Data contents are never deleted. One that a content stops referencing
    // may still be referenced by another (e.g. a document created from the
    // same template), and the stored files behind them are never removed
    // either.

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
 * The data content to attach to a content, or null for none. Throws if the
 * data content does not exist or is not the type the content type can hold.
 */
const resolveDataContentId = (
  dataContentId: string | null | undefined,
  contentType: EnvelopeContentType,
  dataContents: Pick<DataContent, 'id' | 'metadata'>[],
) => {
  if (!dataContentId) {
    return null;
  }

  const dataContent = dataContents.find((item) => item.id === dataContentId);

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
