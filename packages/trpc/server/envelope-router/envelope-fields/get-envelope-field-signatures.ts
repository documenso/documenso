import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../../trpc';
import {
  ZGetEnvelopeFieldSignaturesRequestSchema,
  ZGetEnvelopeFieldSignaturesResponseSchema,
} from './get-envelope-field-signatures.types';

export const getEnvelopeFieldSignaturesRoute = authenticatedProcedure
  .input(ZGetEnvelopeFieldSignaturesRequestSchema)
  .output(ZGetEnvelopeFieldSignaturesResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    // Validate the user has access to the envelope.
    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
      userId: user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findFirst({
      where: envelopeWhereInput,
      include: {
        fields: {
          where: {
            inserted: true,
            type: FieldType.SIGNATURE,
          },
          include: {
            signature: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    const signatures = envelope.fields.map((field) => ({
      fieldId: field.id,
      signatureImageAsBase64: field.signature?.signatureImageAsBase64 ?? null,
      typedSignature: field.signature?.typedSignature ?? null,
    }));

    return signatures;
  });
