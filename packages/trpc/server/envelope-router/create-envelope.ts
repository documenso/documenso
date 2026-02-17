import { EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { extractPdfPlaceholders } from '@documenso/lib/server-only/pdf/auto-place-fields';
import { normalizePdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';

import { insertFormValuesInPdf } from '../../../lib/server-only/pdf/insert-form-values-in-pdf';
import { authenticatedProcedure } from '../trpc';
import type { TCreateEnvelopeRequest } from './create-envelope.types';
import {
  ZCreateEnvelopeRequestSchema,
  ZCreateEnvelopeResponseSchema,
  createEnvelopeMeta,
} from './create-envelope.types';

export const createEnvelopeRoute = authenticatedProcedure
  .meta(createEnvelopeMeta)
  .input(ZCreateEnvelopeRequestSchema)
  .output(ZCreateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({
      input: {
        folderId: input.payload.folderId,
      },
    });

    return await createEnvelopeRouteCaller({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      input,
      apiRequestMetadata: ctx.metadata,
    });
  });

type CreateEnvelopeRouteOptions = {
  /**
   * Verified user ID.
   */
  userId: number;

  /**
   * Unverified team ID.
   */
  teamId: number;
  input: TCreateEnvelopeRequest;
  apiRequestMetadata: ApiRequestMetadata;

  options?: {
    bypassDefaultRecipients?: boolean;
  };
};

export const createEnvelopeRouteCaller = async ({
  userId,
  teamId,
  input,
  apiRequestMetadata,
  options = {},
}: CreateEnvelopeRouteOptions) => {
  const { payload, files } = input;

  const {
    title,
    type,
    externalId,
    visibility,
    globalAccessAuth,
    globalActionAuth,
    formValues,
    recipients,
    folderId,
    meta,
    attachments,
    delegatedDocumentOwner,
  } = payload;

  const { remaining, maximumEnvelopeItemCount } = await getServerLimits({
    userId,
    teamId,
  });

  if (remaining.documents <= 0) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'You have reached your document limit for this month. Please upgrade your plan.',
      statusCode: 400,
    });
  }

  if (files.length > maximumEnvelopeItemCount) {
    throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
      message: `You cannot upload more than ${maximumEnvelopeItemCount} envelope items per envelope`,
      statusCode: 400,
    });
  }

  if (files.some((file) => !file.type.startsWith('application/pdf'))) {
    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'You cannot upload non-PDF files',
      statusCode: 400,
    });
  }

  // For each file: normalize, extract & clean placeholders, then upload.
  const envelopeItems = await Promise.all(
    files.map(async (file) => {
      let pdf = Buffer.from(await file.arrayBuffer());

      if (formValues) {
        // eslint-disable-next-line require-atomic-updates
        pdf = await insertFormValuesInPdf({
          pdf,
          formValues,
        });
      }

      const normalized = await normalizePdf(pdf, {
        flattenForm: type !== EnvelopeType.TEMPLATE,
      });

      // Todo: Embeds - Does this need to be done on the frontend?
      const { cleanedPdf, placeholders } = await extractPdfPlaceholders(normalized);

      const { id: documentDataId } = await putPdfFileServerSide({
        name: file.name,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(cleanedPdf),
      });

      return {
        title: file.name,
        documentDataId,
        placeholders,
      };
    }),
  );

  const recipientsToCreate = recipients?.map((recipient) => ({
    email: recipient.email,
    name: recipient.name,
    role: recipient.role,
    signingOrder: recipient.signingOrder,
    accessAuth: recipient.accessAuth,
    actionAuth: recipient.actionAuth,
    fields: recipient.fields?.map((field) => {
      let documentDataId: string | undefined = undefined;

      if (typeof field.identifier === 'string') {
        documentDataId = envelopeItems.find(
          (item) => item.title === field.identifier,
        )?.documentDataId;
      }

      if (typeof field.identifier === 'number') {
        documentDataId = envelopeItems.at(field.identifier)?.documentDataId;
      }

      if (field.identifier === undefined) {
        documentDataId = envelopeItems.at(0)?.documentDataId;
      }

      if (!documentDataId) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Document data not found',
        });
      }

      return {
        ...field,
        documentDataId,
      };
    }),
  }));

  const envelope = await createEnvelope({
    userId,
    teamId,
    internalVersion: 2,
    data: {
      type,
      title,
      externalId,
      formValues,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      recipients: recipientsToCreate,
      folderId,
      envelopeItems,
      delegatedDocumentOwner,
    },
    attachments,
    meta,
    requestMetadata: apiRequestMetadata,
    bypassDefaultRecipients: options.bypassDefaultRecipients,
  });

  return {
    id: envelope.id,
  };
};
