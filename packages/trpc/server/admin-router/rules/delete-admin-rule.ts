import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

import { adminProcedure } from '../../trpc';
import { ZDeleteAdminRuleRequestSchema, ZDeleteAdminRuleResponseSchema } from './delete-admin-rule.types';

export const deleteAdminRuleRoute = adminProcedure
  .input(ZDeleteAdminRuleRequestSchema)
  .output(ZDeleteAdminRuleResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { ruleId } = input;

    ctx.logger.info({
      input: {
        ruleId,
      },
    });

    try {
      await prisma.adminRule.delete({
        where: {
          id: ruleId,
        },
      });
    } catch (err) {
      // P2025: no rule matched, so report NOT_FOUND rather than a 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Rule not found' });
      }

      throw err;
    }
  });
