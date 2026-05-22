import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { UNSAFE_importAcroFormFieldsFromEnvelope } from '@documenso/lib/server-only/envelope-item/import-acroform-fields';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import {
  ZImportAcroFormFieldsRequestSchema,
  ZImportAcroFormFieldsResponseSchema,
} from './import-acroform-fields.types';

/**
 * Internal-only — driven by the "Import from PDF" button in the envelope editor.
 *
 * Extracts AcroForm widgets from each envelope item's stored PDF, creates
 * Documenso `Field` rows for the supported widgets, flattens the PDF in place
 * (so widgets do not visually duplicate the imported fields), and emits a
 * `FIELD_CREATED` audit entry per field on DOCUMENT envelopes.
 */
export const importAcroFormFieldsRoute = authenticatedProcedure
  .input(ZImportAcroFormFieldsRequestSchema)
  .output(ZImportAcroFormFieldsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({ input: { envelopeId } });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: { type: 'envelopeId', id: envelopeId },
      type: null,
      userId: user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
      include: {
        recipients: true,
        envelopeItems: {
          include: { documentData: true },
          orderBy: { order: 'asc' },
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
        message: 'AcroForm import is only supported for version 2 envelopes',
      });
    }

    if (envelope.status !== DocumentStatus.DRAFT) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'AcroForm import is only allowed while the envelope is in draft',
      });
    }

    if (envelope.envelopeItems.length === 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope has no items to import from',
      });
    }

    return await UNSAFE_importAcroFormFieldsFromEnvelope({
      envelope,
      apiRequestMetadata: metadata,
    });
  });
