import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { updateEnvelope } from '@documenso/lib/server-only/envelope/update-envelope';
import { createEnvelopeContentImages } from '@documenso/lib/server-only/envelope-content/create-envelope-content-images';
import { setEnvelopeContents } from '@documenso/lib/server-only/envelope-content/set-envelope-contents';
import { UNSAFE_createEnvelopeItems } from '@documenso/lib/server-only/envelope-item/create-envelope-items';
import { UNSAFE_deleteEnvelopeItem } from '@documenso/lib/server-only/envelope-item/delete-envelope-item';
import { UNSAFE_replaceEnvelopeItemPdf } from '@documenso/lib/server-only/envelope-item/replace-envelope-item-pdf';
import { UNSAFE_updateEnvelopeItems } from '@documenso/lib/server-only/envelope-item/update-envelope-items';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setFieldsForTemplate } from '@documenso/lib/server-only/field/set-fields-for-template';
import { setDocumentRecipients } from '@documenso/lib/server-only/recipient/set-document-recipients';
import { setTemplateRecipients } from '@documenso/lib/server-only/recipient/set-template-recipients';
import { CONTENT_TYPE_DATA_CONTENT_TYPE } from '@documenso/lib/types/envelope-content-meta';
import { nanoid } from '@documenso/lib/universal/id';
import {
  PRESIGNED_ENVELOPE_CONTENT_ID_PREFIX,
  PRESIGNED_ENVELOPE_ITEM_ID_PREFIX,
} from '@documenso/lib/utils/embed-config';
import { canContentBeChanged, getEnvelopeItemPermissions } from '@documenso/lib/utils/envelope';
import { assertEnvelopeContentSaveWithinLimits } from '@documenso/lib/utils/envelope-content';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, type EnvelopeContent, EnvelopeType, type OrganisationClaim } from '@prisma/client';
import pMap from 'p-map';
import { match } from 'ts-pattern';

import { procedure } from '../trpc';
import {
  type TUpdateEmbeddingEnvelopePayload,
  ZUpdateEmbeddingEnvelopeRequestSchema,
  ZUpdateEmbeddingEnvelopeResponseSchema,
} from './update-embedding-envelope.types';

export const updateEmbeddingEnvelopeRoute = procedure
  .input(ZUpdateEmbeddingEnvelopeRequestSchema)
  .output(ZUpdateEmbeddingEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { payload, files, contentImages } = input;
    const { envelopeId, data, meta } = payload;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const authorizationHeader = ctx.req.headers.get('authorization');

    const [presignToken] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

    if (!presignToken) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'No presign token provided',
      });
    }

    const apiToken = await verifyEmbeddingPresignToken({
      token: presignToken,
      scope: `envelopeId:${envelopeId}`,
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null, // Allow updating both documents and templates.
      userId: apiToken.userId,
      teamId: apiToken.teamId,
    });

    const envelope = await prisma.envelope.findFirst({
      where: envelopeWhereInput,
      include: {
        envelopeItems: true,
        team: {
          select: {
            organisation: {
              select: {
                organisationClaim: true,
              },
            },
          },
        },
        recipients: true,
        envelopeAttachments: true,
        contents: {
          select: {
            id: true,
            envelopeItemId: true,
            contentMeta: true,
            dataContentId: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (envelope.status === DocumentStatus.COMPLETED) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Cannot modify completed envelope',
      });
    }

    // Contents are frozen once the envelope has been sent, and the editor does
    // not let them be changed from then on, so they are only saved before.
    const contentsToSet = data.contents && canContentBeChanged(envelope) ? data.contents : null;

    // Step 1: Update the envelope items.
    const envelopeItemsToUpdate: EnvelopeItemUpdateOptions[] = [];
    const envelopeItemsToCreate: EnvelopeItemCreateOptions[] = [];
    const envelopeItemsToReplace: EnvelopeItemReplaceOptions[] = [];

    // Sort and group envelope items to update, create, and replace.
    data.envelopeItems.forEach((item) => {
      const isNewEnvelopeItem = item.id.startsWith(PRESIGNED_ENVELOPE_ITEM_ID_PREFIX);

      // Handle existing envelope items.
      if (!isNewEnvelopeItem) {
        const envelopeItem = envelope.envelopeItems.find((envelopeItem) => envelopeItem.id === item.id);

        if (!envelopeItem) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Envelope item not found',
          });
        }

        // Check if this existing item has a replacement file.
        if (item.replaceFileIndex !== undefined) {
          const replaceFile = files[item.replaceFileIndex];

          if (!replaceFile) {
            throw new AppError(AppErrorCode.INVALID_BODY, {
              message: 'Invalid replace file index',
            });
          }

          envelopeItemsToReplace.push({
            envelopeItemId: envelopeItem.id,
            oldDocumentDataId: envelopeItem.documentDataId,
            title: item.title,
            order: item.order,
            file: replaceFile,
          });

          return;
        }

        const hasEnvelopeItemChanged = envelopeItem.title !== item.title || envelopeItem.order !== item.order;

        if (hasEnvelopeItemChanged) {
          envelopeItemsToUpdate.push({
            envelopeItemId: envelopeItem.id,
            title: item.title,
            order: item.order,
          });
        }

        // Return to continue loop.
        return;
      }

      const newEnvelopeItemFile = item.index !== undefined ? files[item.index] : undefined;

      if (!newEnvelopeItemFile) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid envelope item index',
        });
      }

      // Handle not yet uploaded envelope items.
      envelopeItemsToCreate.push({
        embeddedEnvelopeItemId: item.id,
        title: item.title,
        order: item.order,
        file: newEnvelopeItemFile,
      });
    });

    // Delete envelope items that have been removed from the payload.
    const envelopeItemIdsToDelete = envelope.envelopeItems
      .filter((item) => !data.envelopeItems.some((i) => i.id === item.id))
      .map((item) => item.id);

    const willEnvelopeItemsBeModified =
      envelopeItemIdsToDelete.length > 0 ||
      envelopeItemsToCreate.length > 0 ||
      envelopeItemsToUpdate.length > 0 ||
      envelopeItemsToReplace.length > 0;

    const organisationClaim = envelope.team.organisation.organisationClaim;
    const resultingEnvelopeItemCount =
      envelope.envelopeItems.length - envelopeItemIdsToDelete.length + envelopeItemsToCreate.length;

    if (resultingEnvelopeItemCount > organisationClaim.envelopeItemCount) {
      throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
        message: `You cannot upload more than ${organisationClaim.envelopeItemCount} envelope items`,
        statusCode: 400,
      });
    }

    // Should be safe to use stale envelope.recipients since only signed or sent
    // recipients affect the outcome.
    if (willEnvelopeItemsBeModified) {
      const permissions = getEnvelopeItemPermissions(envelope, envelope.recipients);

      const hasFileChange = envelopeItemIdsToDelete.length > 0 || envelopeItemsToCreate.length > 0;

      const hasOrderChange = envelopeItemsToUpdate.some((item) => {
        const existing = envelope.envelopeItems.find((e) => e.id === item.envelopeItemId);

        return !existing || item.order !== existing.order;
      });

      const hasTitleChange = envelopeItemsToUpdate.some((item) => item.title !== undefined);

      if (hasFileChange && !permissions.canFileBeChanged) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Envelope item files are not editable',
        });
      }

      if (hasOrderChange && !permissions.canOrderBeChanged) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Envelope item order is not editable',
        });
      }

      if (hasTitleChange && !permissions.canTitleBeChanged) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Envelope item title is not editable',
        });
      }
    }

    // Check the contents before anything is written, since they are only set
    // in the last step, so an invalid content cannot leave the envelope half
    // updated.
    if (contentsToSet) {
      assertEmbeddedContentsCanBeSet({
        contents: contentsToSet,
        envelopeItemIds: data.envelopeItems.map((item) => item.id),
        existingContents: envelope.contents,
        claim: organisationClaim,
      });
    }

    // Store the new images the contents use, once each, before anything else
    // is written so an invalid image or index fails the request cleanly.
    const contentImageDataContents = await createEnvelopeContentImages({
      contents: contentsToSet ?? [],
      images: contentImages,
    });

    if (envelopeItemIdsToDelete.length > 0) {
      await pMap(
        envelopeItemIdsToDelete,
        async (envelopeItemId) => {
          await UNSAFE_deleteEnvelopeItem({
            envelopeId: envelope.id,
            envelopeItemId,
            user: apiToken.user,
            apiRequestMetadata: ctx.metadata,
          });
        },
        { concurrency: 2 },
      );
    }

    // Mapping for the client side embedded prefix envelope item IDs to the real envelope item IDs.
    const embeddedEnvelopeItemIdMapping: Record<string, string> = {};

    // Create new envelope items.
    if (envelopeItemsToCreate.length > 0) {
      const createdEnvelopeItems = await UNSAFE_createEnvelopeItems({
        files: envelopeItemsToCreate.map((item) => ({
          clientId: item.embeddedEnvelopeItemId,
          file: item.file,
          orderOverride: item.order,
        })),
        envelope: {
          ...envelope,
          // Purposefully putting empty recipients here since placeholders should automatically injected on the client side for
          // embedded purposes. Todo: Embeds - (Not implemeneted yet)
          recipients: [],
        },
        user: {
          id: apiToken.user.id,
          name: apiToken.user.name,
          email: apiToken.user.email,
        },
        apiRequestMetadata: ctx.metadata,
      });

      // Build the map from the envelope item order.
      createdEnvelopeItems.forEach((item) => {
        if (!item.clientId) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Client ID not found',
          });
        }

        embeddedEnvelopeItemIdMapping[item.clientId] = item.id;
      });
    }

    /**
     * Resolve an envelope item ID sent by the client, which is the temporary
     * ID for items created in this request.
     */
    const resolveEnvelopeItemId = (clientEnvelopeItemId: string) => {
      let envelopeItemId = clientEnvelopeItemId;

      if (envelopeItemId.startsWith(PRESIGNED_ENVELOPE_ITEM_ID_PREFIX)) {
        envelopeItemId = embeddedEnvelopeItemIdMapping[envelopeItemId];
      }

      if (!envelopeItemId) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Envelope item not found',
        });
      }

      return envelopeItemId;
    };

    if (envelopeItemsToUpdate.length > 0) {
      await UNSAFE_updateEnvelopeItems({
        envelopeId: envelope.id,
        envelopeType: envelope.type,
        existingEnvelopeItems: envelope.envelopeItems,
        data: envelopeItemsToUpdate,
        user: {
          name: apiToken.user.name,
          email: apiToken.user.email,
        },
        apiRequestMetadata: ctx.metadata,
      });
    }

    // Replace PDFs for existing envelope items without creating placeholder fields
    // field cleanup is handled in later steps.
    if (envelopeItemsToReplace.length > 0) {
      await pMap(
        envelopeItemsToReplace,
        async (item) => {
          await UNSAFE_replaceEnvelopeItemPdf({
            envelope,
            recipients: [],
            envelopeItemId: item.envelopeItemId,
            oldDocumentDataId: item.oldDocumentDataId,
            data: {
              title: item.title,
              order: item.order,
              file: item.file,
            },
            user: apiToken.user,
            apiRequestMetadata: ctx.metadata,
          });
        },
        { concurrency: 2 },
      );
    }

    // Step 2: Update the general envelope data and meta.
    await updateEnvelope({
      userId: apiToken.userId,
      teamId: apiToken.teamId,
      id: {
        type: 'envelopeId',
        id: envelope.id,
      },
      data: {
        title: data.title,
        externalId: data.externalId,
        visibility: data.visibility,
        globalAccessAuth: data.globalAccessAuth,
        globalActionAuth: data.globalActionAuth,
        folderId: data.folderId,
      },
      meta,
      requestMetadata: ctx.metadata,
    });

    // Step 3: Update the recipients
    const recipientsWithClientId = data.recipients.map((recipient) => ({
      ...recipient,
      clientId: nanoid(),
    }));

    const { recipients: updatedRecipients } = await match(envelope.type)
      .with(EnvelopeType.DOCUMENT, async () =>
        setDocumentRecipients({
          userId: apiToken.userId,
          teamId: apiToken.teamId,
          id: {
            type: 'envelopeId',
            id: envelope.id,
          },
          recipients: recipientsWithClientId.map((recipient) => ({
            id: recipient.id,
            clientId: recipient.clientId,
            email: recipient.email,
            name: recipient.name ?? '',
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            actionAuth: recipient.actionAuth,
          })),
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        setTemplateRecipients({
          userId: apiToken.userId,
          teamId: apiToken.teamId,
          id: {
            type: 'envelopeId',
            id: envelope.id,
          },
          recipients: recipientsWithClientId.map((recipient) => ({
            id: recipient.id,
            clientId: recipient.clientId,
            email: recipient.email,
            name: recipient.name ?? '',
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            actionAuth: recipient.actionAuth,
          })),
        }),
      )
      .exhaustive();

    // Step 4: Update the fields.
    const fields = recipientsWithClientId.flatMap((recipient) => {
      const recipientId = updatedRecipients.find((r) => r.clientId === recipient.clientId)?.id;

      if (!recipientId) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Recipient not found',
        });
      }

      return (recipient.fields ?? []).map((field) => ({
        ...field,
        recipientId,
        envelopeItemId: resolveEnvelopeItemId(field.envelopeItemId),
      }));
    });

    await match(envelope.type)
      .with(EnvelopeType.DOCUMENT, async () =>
        setFieldsForDocument({
          userId: apiToken.userId,
          teamId: apiToken.teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          fields: fields.map((field) => ({
            ...field,
            pageNumber: field.page,
            pageX: field.positionX,
            pageY: field.positionY,
            pageWidth: field.width,
            pageHeight: field.height,
          })),
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        setFieldsForTemplate({
          userId: apiToken.userId,
          teamId: apiToken.teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          fields: fields.map((field) => ({
            ...field,
            pageNumber: field.page,
            pageX: field.positionX,
            pageY: field.positionY,
            pageWidth: field.width,
            pageHeight: field.height,
          })),
        }),
      )
      .exhaustive();

    // Step 5: Handle attachments (set semantics: delete all existing, create new).
    let hasEnvelopeAttachmentsChanged = envelope.envelopeAttachments.length !== data.attachments.length;

    data.attachments.forEach((attachment) => {
      const foundAttachment = envelope.envelopeAttachments.find((a) => a.id === attachment.id);

      if (!foundAttachment) {
        hasEnvelopeAttachmentsChanged = true;
        return;
      }

      const hasAttachmentChanged =
        foundAttachment.label !== attachment.label ||
        foundAttachment.data !== attachment.data ||
        foundAttachment.type !== attachment.type;

      if (hasAttachmentChanged) {
        hasEnvelopeAttachmentsChanged = true;
        return;
      }
    });

    if (hasEnvelopeAttachmentsChanged) {
      await prisma.envelopeAttachment.deleteMany({
        where: {
          envelopeId: envelope.id,
        },
      });

      if (data.attachments.length > 0) {
        await prisma.envelopeAttachment.createMany({
          data: data.attachments.map((attachment) => ({
            envelopeId: envelope.id,
            label: attachment.label,
            data: attachment.data,
            type: attachment.type,
          })),
        });
      }
    }

    // Step 6: Update the contents.
    if (contentsToSet) {
      await setEnvelopeContents({
        userId: apiToken.userId,
        teamId: apiToken.teamId,
        id: {
          type: 'envelopeId',
          id: envelope.id,
        },
        contents: contentsToSet.map((content) => ({
          // New contents only have a temporary ID, which creates them.
          id: content.id.startsWith(PRESIGNED_ENVELOPE_CONTENT_ID_PREFIX) ? undefined : content.id,
          envelopeItemId: resolveEnvelopeItemId(content.envelopeItemId),
          contentMeta: content.contentMeta,
          dataContentId:
            content.imageIndex !== undefined
              ? (contentImageDataContents.get(content.imageIndex)?.id ?? null)
              : content.dataContentId,
        })),
        newDataContents: [...contentImageDataContents.values()],
        requestMetadata: ctx.metadata,
      });
    }
  });

type AssertEmbeddedContentsCanBeSetOptions = {
  contents: NonNullable<TUpdateEmbeddingEnvelopePayload['data']['contents']>;

  /**
   * The IDs of the envelope items the envelope will have, temporary ones
   * included.
   */
  envelopeItemIds: string[];

  existingContents: Pick<EnvelopeContent, 'id' | 'envelopeItemId' | 'contentMeta' | 'dataContentId'>[];
  claim: Pick<OrganisationClaim, 'envelopeContentCount' | 'envelopeContentImageCount'>;
};

/**
 * Throw if the contents cannot be set.
 *
 * `setEnvelopeContents` checks the same, but it runs last, once the envelope
 * items, recipients and fields have already been written. Checking up front
 * means a request which would fail there changes nothing.
 *
 * New images (`imageIndex`) are checked by `createEnvelopeContentImages`,
 * which also runs before anything is written.
 */
const assertEmbeddedContentsCanBeSet = ({
  contents,
  envelopeItemIds,
  existingContents,
  claim,
}: AssertEmbeddedContentsCanBeSetOptions) => {
  // Contents on the envelope items being deleted go along with them.
  const remainingContents = existingContents.filter((content) => envelopeItemIds.includes(content.envelopeItemId));

  assertEnvelopeContentSaveWithinLimits({
    incomingTypes: contents.map((content) => content.contentMeta.type),
    existingTypes: remainingContents.map((content) => content.contentMeta.type),
    claim,
  });

  // Only images already attached to this envelope may be reused, so a
  // request cannot attach another envelope's image by its ID.
  const attachedImageIds = new Set(
    remainingContents.flatMap((content) => (content.dataContentId ? [content.dataContentId] : [])),
  );

  for (const content of contents) {
    if (!envelopeItemIds.includes(content.envelopeItemId)) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope item not found',
      });
    }

    // Like envelope items, anything which is not a temporary ID must already
    // exist, rather than being silently created.
    if (!content.id.startsWith(PRESIGNED_ENVELOPE_CONTENT_ID_PREFIX)) {
      const existingContent = existingContents.find((existing) => existing.id === content.id);

      if (!existingContent) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Envelope content not found',
        });
      }

      if (existingContent.envelopeItemId !== content.envelopeItemId) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: `Content ${content.id} cannot be moved to a different envelope item`,
        });
      }
    }

    if (!content.dataContentId) {
      continue;
    }

    if (!CONTENT_TYPE_DATA_CONTENT_TYPE[content.contentMeta.type]) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `A ${content.contentMeta.type} content cannot hold an image`,
      });
    }

    if (!attachedImageIds.has(content.dataContentId)) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Data content ${content.dataContentId} not found`,
      });
    }
  }
};

type EnvelopeItemUpdateOptions = {
  envelopeItemId: string;
  title?: string;
  order?: number;
};

type EnvelopeItemCreateOptions = {
  embeddedEnvelopeItemId: string;
  title: string;
  order: number;
  file: File;
};

type EnvelopeItemReplaceOptions = {
  envelopeItemId: string;
  oldDocumentDataId: string;
  title: string;
  order: number;
  file: File;
};
