import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { deleteDocumentField } from '@documenso/lib/server-only/field/delete-document-field';
import { deleteTemplateField } from '@documenso/lib/server-only/field/delete-template-field';
import { prisma } from '@documenso/prisma';

import { ZGenericSuccessResponse } from '../../schema';
import { authenticatedProcedure } from '../../trpc';
import {
  ZDeleteEnvelopeFieldRequestSchema,
  ZDeleteEnvelopeFieldResponseSchema,
  deleteEnvelopeFieldMeta,
} from './delete-envelope-field.types';

export const deleteEnvelopeFieldRoute = authenticatedProcedure
  .meta(deleteEnvelopeFieldMeta)
  .input(ZDeleteEnvelopeFieldRequestSchema)
  .output(ZDeleteEnvelopeFieldResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { fieldId, force } = input;

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    const unsafeField = await prisma.field.findUnique({
      where: {
        id: fieldId,
      },
      select: {
        envelopeId: true,
      },
    });

    if (!unsafeField) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Field not found',
      });
    }

    const envelope = await prisma.envelope.findUnique({
      where: {
        id: unsafeField.envelopeId,
      },
      select: {
        type: true,
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (envelope.type === EnvelopeType.DOCUMENT) {
      await deleteDocumentField({
        userId: user.id,
        teamId,
        fieldId,
        requestMetadata: metadata,
        force,
      });
    } else {
      await deleteTemplateField({
        userId: user.id,
        teamId,
        fieldId,
        force,
      });
    }

    return ZGenericSuccessResponse;
  });
