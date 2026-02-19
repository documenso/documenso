import { DocumentStatus, EnvelopeType } from '@prisma/client';
import pMap from 'p-map';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { updateEnvelope } from '@documenso/lib/server-only/envelope/update-envelope';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setFieldsForTemplate } from '@documenso/lib/server-only/field/set-fields-for-template';
import { setDocumentRecipients } from '@documenso/lib/server-only/recipient/set-document-recipients';
import { setTemplateRecipients } from '@documenso/lib/server-only/recipient/set-template-recipients';
import { nanoid } from '@documenso/lib/universal/id';
import { PRESIGNED_ENVELOPE_ITEM_ID_PREFIX } from '@documenso/lib/utils/embed-config';
import { canEnvelopeItemsBeModified } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { UNSAFE_createEnvelopeItems } from '@documenso/trpc/server/envelope-router/create-envelope-items';
import { UNSAFE_deleteEnvelopeItem } from '@documenso/trpc/server/envelope-router/delete-envelope-item';
import { UNSAFE_updateEnvelopeItems } from '@documenso/trpc/server/envelope-router/update-envelope-items';

import { procedure } from '../trpc';
import {
  ZUpdateEmbeddingEnvelopeRequestSchema,
  ZUpdateEmbeddingEnvelopeResponseSchema,
} from './update-embedding-envelope.types';

export const updateEmbeddingEnvelopeRoute = procedure
  .input(ZUpdateEmbeddingEnvelopeRequestSchema)
  .output(ZUpdateEmbeddingEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { payload, files } = input;
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

    // Step 1: Update the envelope items.
    const envelopeItemsToUpdate: EnvelopeItemUpdateOptions[] = [];
    const envelopeItemsToCreate: EnvelopeItemCreateOptions[] = [];

    // Sort and group envelope items to update and create.
    data.envelopeItems.forEach((item) => {
      const isNewEnvelopeItem = item.id.startsWith(PRESIGNED_ENVELOPE_ITEM_ID_PREFIX);

      // Handle existing envelope items.
      if (!isNewEnvelopeItem) {
        const envelopeItem = envelope.envelopeItems.find(
          (envelopeItem) => envelopeItem.id === item.id,
        );

        if (!envelopeItem) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Envelope item not found',
          });
        }

        const hasEnvelopeItemChanged =
          envelopeItem.title !== item.title || envelopeItem.order !== item.order;

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
      envelopeItemsToUpdate.length > 0;

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
    if (willEnvelopeItemsBeModified && !canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    if (envelopeItemIdsToDelete.length > 0) {
      console.log('[DEBUG]: Deleting envelope items', envelopeItemIdsToDelete);

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
      console.log('[DEBUG]: Creating envelope items', envelopeItemsToCreate);

      const createdEnvelopeItems = await UNSAFE_createEnvelopeItems({
        files: envelopeItemsToCreate.map((item) => ({
          clientId: item.embeddedEnvelopeItemId,
          file: item.file,
          orderOverride: item.order,
        })),
        envelope: {
          ...envelope,
          // Purposefully putting empty recipients here since placeholders should automatically injected on the client side for
          // embeded purposes. Todo: Embeds - (Not implemeneted yet)
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

    if (envelopeItemsToUpdate.length > 0) {
      console.log('[DEBUG]: Updating envelope items', envelopeItemsToUpdate);

      await UNSAFE_updateEnvelopeItems({
        envelopeId: envelope.id,
        data: envelopeItemsToUpdate,
      });
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

      return (recipient.fields ?? []).map((field) => {
        let envelopeItemId = field.envelopeItemId;

        if (envelopeItemId.startsWith(PRESIGNED_ENVELOPE_ITEM_ID_PREFIX)) {
          envelopeItemId = embeddedEnvelopeItemIdMapping[envelopeItemId];
        }

        if (!envelopeItemId) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Envelope item not found',
          });
        }

        return {
          ...field,
          recipientId,
          envelopeItemId,
        };
      });
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
  });

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
