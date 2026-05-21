import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { convertToPdf } from '@documenso/lib/server-only/document-conversion';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { extractAcroFormFieldsFromPDF } from '@documenso/lib/server-only/pdf/acroform-fields';
import { extractPdfPlaceholders } from '@documenso/lib/server-only/pdf/auto-place-fields';
import { normalizePdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { EnvelopeType } from '@prisma/client';
import type { Logger } from 'pino';

import { insertFormValuesInPdf } from '../../../lib/server-only/pdf/insert-form-values-in-pdf';
import { authenticatedProcedure } from '../trpc';
import type { TCreateEnvelopeRequest } from './create-envelope.types';
import {
  createEnvelopeMeta,
  ZCreateEnvelopeRequestSchema,
  ZCreateEnvelopeResponseSchema,
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
      logger: ctx.logger,
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

  /**
   * Optional pino logger threaded from the calling tRPC context. Passed to
   * downstream helpers (e.g. `convertToPdf`) for structured logging.
   */
  logger?: Logger;

  options?: {
    bypassDefaultRecipients?: boolean;
  };
};

export const createEnvelopeRouteCaller = async ({
  userId,
  teamId,
  input,
  apiRequestMetadata,
  logger,
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

  // For each file: convert to PDF if needed, extract AcroForm widgets,
  // normalize (which flattens the form unless we detected a signed signature
  // and unless this is a template upload), extract & clean placeholders,
  // then upload.
  const envelopeItems = await Promise.all(
    files.map(async (file) => {
      let pdf = await convertToPdf(file, logger);

      if (formValues) {
        // eslint-disable-next-line require-atomic-updates
        pdf = await insertFormValuesInPdf({
          pdf,
          formValues,
        });
      }

      // Run AcroForm extraction BEFORE normalizePdf — flattening destroys
      // widget geometry, which we need to reuse as Documenso fields.
      const acroFormExtraction = await extractAcroFormFieldsFromPDF(pdf, {
        formValuesProvided: Boolean(formValues),
      });

      if (acroFormExtraction.skipReason) {
        logger?.info(
          {
            event: 'acroform-import.skip',
            envelopeItemTitle: file.name,
            reason: acroFormExtraction.skipReason,
          },
          'AcroForm extraction skipped',
        );
      }

      if (acroFormExtraction.unsupported.length > 0) {
        const byReason: Record<string, number> = {};

        for (const entry of acroFormExtraction.unsupported) {
          byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
        }

        logger?.info(
          {
            event: 'acroform-import.unsupported',
            envelopeItemTitle: file.name,
            count: acroFormExtraction.unsupported.length,
            byReason,
          },
          'AcroForm import skipped unsupported widgets',
        );
      }

      if (acroFormExtraction.hasSignedSignature) {
        logger?.warn(
          {
            event: 'acroform-import.signed-pdf-no-flatten',
            envelopeItemTitle: file.name,
          },
          'Signed AcroForm signature detected — skipping flatten to preserve signature',
        );
      }

      const shouldFlatten = type !== EnvelopeType.TEMPLATE && !acroFormExtraction.hasSignedSignature;

      const normalized = await normalizePdf(pdf, {
        flattenForm: shouldFlatten,
      });

      // Todo: Embeds - Might need to add this for client-side embeds in the future.
      const { cleanedPdf, placeholders } = await extractPdfPlaceholders(normalized);

      const { documentData } = await putPdfFileServerSide({
        name: file.name,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(cleanedPdf),
      });

      return {
        title: file.name,
        documentDataId: documentData.id,
        placeholders,
        acroFormFields: acroFormExtraction.fields,
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
      let documentDataId: string | undefined;

      if (typeof field.identifier === 'string') {
        documentDataId = envelopeItems.find((item) => item.title === field.identifier)?.documentDataId;
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
