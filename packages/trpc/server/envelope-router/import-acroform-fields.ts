import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { UNSAFE_importAcroFormFields } from '@documenso/lib/server-only/envelope-item/import-acroform-fields';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import {
  ZImportAcroFormFieldsRequestSchema,
  ZImportAcroFormFieldsResponseSchema,
} from './import-acroform-fields.types';

export const importAcroFormFieldsRoute = authenticatedProcedure
  .input(ZImportAcroFormFieldsRequestSchema)
  .output(ZImportAcroFormFieldsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { envelopeId, envelopeItemId, recipientId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        envelopeItemId,
        recipientId,
      },
    });

    // Documents only: a template keeps its PDF form, so that a document
    // created from the template can still receive form values.
    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
      include: {
        recipients: true,
        fields: true,
        envelopeItems: {
          include: {
            documentData: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'PDF form import is only supported for version 2 envelopes',
      });
    }

    if (envelope.status !== DocumentStatus.DRAFT) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'PDF form import is only allowed while the envelope is a draft',
      });
    }

    const envelopeItem = envelope.envelopeItems.find((item) => item.id === envelopeItemId);

    if (!envelopeItem) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope item not found',
      });
    }

    const recipient = envelope.recipients.find((recipient) => recipient.id === recipientId);

    if (!recipient || !canRecipientFieldsBeModified(recipient, envelope.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Recipient not found, or the recipient cannot have fields',
      });
    }

    const fields = await UNSAFE_importAcroFormFields({
      envelope,
      envelopeItem,
      recipient,
      apiRequestMetadata: metadata,
    });

    return {
      fieldsCreated: fields.length,
    };
  });
