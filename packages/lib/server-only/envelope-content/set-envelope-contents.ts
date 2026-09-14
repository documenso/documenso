import type { TEnvelopeContentMetaInput } from '@documenso/lib/types/envelope-content-meta';
import { CONTENT_MAX_Z_INDEX, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { generateDatabaseId } from '../../universal/id';
import type { CreateDocumentAuditLogDataResponse } from '../../utils/document-audit-logs';
import { createDocumentAuditLogData, diffContentChanges } from '../../utils/document-audit-logs';
import { canContentBeChanged, type EnvelopeIdOptions } from '../../utils/envelope';
import { assertEnvelopeContentSaveWithinLimits } from '../../utils/envelope-content';
import { buildDataContentCloneInput } from '../data-content/clone-data-content';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { resolveDataContentLinks } from './resolve-data-content-links';

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

    envelopeItemId: string;
    metadata: TEnvelopeContentMetaInput;

    /**
     * The ID of an uploaded data content (e.g. an image) to attach to the
     * content. Omit or set to null to detach any existing data content.
     */
    dataContentId?: string | null;

    /**
     * The stacking order among the contents of the page, higher on top.
     * Omit to keep an existing content's order, or to place a new content
     * above every other content on its page.
     */
    zIndex?: number;
  }[];
  requestMetadata: ApiRequestMetadata;
};

/**
 * Replace the contents of an envelope with the given list.
 *
 * Existing contents not present in the list are deleted, contents with a
 * matching ID are updated, and the rest are created.
 *
 * Data contents referenced by the list are attached, cloning those which are
 * already attached elsewhere. Data contents no longer referenced by any
 * content of the envelope are deleted.
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
    incomingTypes: contents.map((content) => ZEnvelopeContentMetaSchema.parse(content.metadata).type),
    existingTypes: existingContents.map((content) => content.metadata.type),
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

    // Only treat the content as existing if it actually belongs to this
    // envelope, otherwise a new content is created.
    const persisted = existingContents.find((existingContent) => existingContent.id === content.id);

    return {
      ...content,
      metadata: ZEnvelopeContentMetaSchema.parse(content.metadata),
      _persisted: persisted,
    };
  });

  const requestedDataContentIds = unique(
    linkedContents.flatMap((content) => (content.dataContentId ? [content.dataContentId] : [])),
  );

  const requestedDataContents =
    requestedDataContentIds.length > 0
      ? await prisma.dataContent.findMany({
          where: {
            id: {
              in: requestedDataContentIds,
            },
          },
          include: {
            envelopeContent: {
              select: {
                id: true,
                envelopeId: true,
              },
            },
          },
        })
      : [];

  const dataContentLinks = resolveDataContentLinks({
    envelopeId: envelope.id,
    contents: linkedContents.map((content) => ({
      persistedId: content._persisted?.id ?? null,
      contentType: content.metadata.type,
      dataContentId: content.dataContentId,
    })),
    dataContents: requestedDataContents,
  });

  // New contents without an explicit order go above everything already on
  // their page, including other new contents placed earlier in this request.
  const nextZIndexByPage = createNextZIndexTracker(
    linkedContents.map((content) => ({
      envelopeItemId: content.envelopeItemId,
      page: content.metadata.page ?? 1,
      zIndex: content.zIndex ?? content._persisted?.zIndex ?? 0,
    })),
  );

  const isAuditLogged = envelope.type === EnvelopeType.DOCUMENT;

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

      if (isAuditLogged) {
        auditLogs.push(
          ...removedContents.map((content) =>
            createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.CONTENT_DELETED,
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                contentId: content.id,
                contentType: content.metadata.type,
                envelopeItemId: content.envelopeItemId,
              },
            }),
          ),
        );
      }
    }

    const upsertResults = await Promise.all(
      linkedContents.map(async (content, index) => {
        const dataContentId = await match(dataContentLinks[index])
          .with({ action: 'none' }, () => null)
          .with({ action: 'keep' }, ({ dataContentId }) => dataContentId)
          .with({ action: 'link' }, ({ dataContentId }) => dataContentId)
          .with({ action: 'clone' }, async ({ sourceDataContentId }) => {
            const source = requestedDataContents.find((dataContent) => dataContent.id === sourceDataContentId);

            if (!source) {
              throw new AppError(AppErrorCode.NOT_FOUND, {
                message: `Data content ${sourceDataContentId} not found`,
              });
            }

            const clonedDataContent = await tx.dataContent.create({
              data: buildDataContentCloneInput(source),
            });

            return clonedDataContent.id;
          })
          .exhaustive();

        if (content._persisted) {
          const updatedContent = await tx.envelopeContent.update({
            where: {
              id: content._persisted.id,
            },
            data: {
              envelopeItemId: content.envelopeItemId,
              metadata: content.metadata,
              dataContentId,
              zIndex: content.zIndex,
            },
          });

          // The editor sends every content on every save, so an update is only
          // logged when something about the content actually changed.
          const changes = diffContentChanges(content._persisted, { metadata: content.metadata, dataContentId });

          let auditLog: CreateDocumentAuditLogDataResponse | null = null;

          if (isAuditLogged && changes.length > 0) {
            auditLog = createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.CONTENT_UPDATED,
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                contentId: updatedContent.id,
                contentType: updatedContent.metadata.type,
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
            metadata: content.metadata,
            dataContentId,
            zIndex: content.zIndex ?? nextZIndexByPage.next(content.envelopeItemId, content.metadata.page ?? 1),
          },
        });

        let auditLog: CreateDocumentAuditLogDataResponse | null = null;

        if (isAuditLogged) {
          auditLog = createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.CONTENT_CREATED,
            envelopeId: envelope.id,
            metadata: requestMetadata,
            data: {
              contentId: createdContent.id,
              contentType: createdContent.metadata.type,
              envelopeItemId: createdContent.envelopeItemId,
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

    // Delete the data contents which were attached to this envelope's
    // contents before the update but are no longer attached to any of them,
    // e.g. those of removed contents or replaced images.
    const previouslyAttachedDataContentIds = existingContents.flatMap((content) =>
      content.dataContentId ? [content.dataContentId] : [],
    );

    const attachedDataContentIds = new Set(
      upsertedContents.flatMap((content) => (content.dataContentId ? [content.dataContentId] : [])),
    );

    const orphanedDataContentIds = previouslyAttachedDataContentIds.filter(
      (dataContentId) => !attachedDataContentIds.has(dataContentId),
    );

    if (orphanedDataContentIds.length > 0) {
      await tx.dataContent.deleteMany({
        where: {
          id: {
            in: orphanedDataContentIds,
          },
        },
      });
    }

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

const unique = <T>(values: T[]) => Array.from(new Set(values));

/**
 * Hands out increasing `zIndex` values per page, starting above the highest
 * one already known for that page.
 */
const createNextZIndexTracker = (contents: { envelopeItemId: string; page: number; zIndex: number }[]) => {
  const highestByPage = new Map<string, number>();

  const keyOf = (envelopeItemId: string, page: number) => `${envelopeItemId}:${page}`;

  for (const content of contents) {
    const key = keyOf(content.envelopeItemId, content.page);

    highestByPage.set(key, Math.max(highestByPage.get(key) ?? -1, content.zIndex));
  }

  return {
    next: (envelopeItemId: string, page: number) => {
      const key = keyOf(envelopeItemId, page);

      // Clamped so a page already at the ceiling keeps accepting contents,
      // which then tie with the topmost one rather than failing to save.
      const next = Math.min((highestByPage.get(key) ?? -1) + 1, CONTENT_MAX_Z_INDEX);

      highestByPage.set(key, next);

      return next;
    },
  };
};
