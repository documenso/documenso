import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import { ZReorderAdminRulesRequestSchema, ZReorderAdminRulesResponseSchema } from './reorder-admin-rules.types';

export const reorderAdminRulesRoute = adminProcedure
  .input(ZReorderAdminRulesRequestSchema)
  .output(ZReorderAdminRulesResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { ruleIds } = input;

    ctx.logger.info({
      input: {
        ruleIds,
      },
    });

    const rules = await prisma.adminRule.findMany({
      select: {
        id: true,
      },
    });

    const existingRuleIds = new Set(rules.map((rule) => rule.id));

    const isFullOrdering =
      ruleIds.length === existingRuleIds.size &&
      new Set(ruleIds).size === ruleIds.length &&
      ruleIds.every((ruleId) => existingRuleIds.has(ruleId));

    if (!isFullOrdering) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, { message: 'Every rule must be included exactly once' });
    }

    await prisma.$transaction(
      ruleIds.map((ruleId, priority) =>
        prisma.adminRule.update({
          where: {
            id: ruleId,
          },
          data: {
            priority,
          },
        }),
      ),
    );
  });
