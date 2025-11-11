import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';

import { insertFormValuesInPdf } from '../../../lib/server-only/pdf/insert-form-values-in-pdf';
import { authenticatedProcedure } from '../trpc';
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
    const { user, teamId } = ctx;

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
    } = payload;

    ctx.logger.info({
      input: {
        folderId,
      },
    });

    const { remaining, maximumEnvelopeItemCount } = await getServerLimits({
      userId: user.id,
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

    // For each file, stream to s3 and create the document data.
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

        const { id: documentDataId } = await putNormalizedPdfFileServerSide({
          name: file.name,
          type: 'application/pdf',
          arrayBuffer: async () => Promise.resolve(pdf),
        });

        return {
          title: file.name,
          documentDataId,
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
      userId: user.id,
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
      },
      attachments,
      meta,
      requestMetadata: ctx.metadata,
    });

    return {
      id: envelope.id,
    };
  });
