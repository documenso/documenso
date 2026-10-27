import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZDeleteEmailSuppressionRequestSchema,
  ZDeleteEmailSuppressionResponseSchema,
} from './delete-email-suppression.types';

export const deleteEmailSuppressionRoute = adminProcedure
  .input(ZDeleteEmailSuppressionRequestSchema)
  .output(ZDeleteEmailSuppressionResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    const { count } = await prisma.emailSuppression.deleteMany({
      where: {
        id,
      },
    });

    if (count === 0) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email suppression not found',
      });
    }
  });
