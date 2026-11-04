import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import { ZGetAdminRuleRequestSchema, ZGetAdminRuleResponseSchema } from './get-admin-rule.types';
import { getAdminRuleListItems } from './get-admin-rules';

export const getAdminRuleRoute = adminProcedure
  .input(ZGetAdminRuleRequestSchema)
  .output(ZGetAdminRuleResponseSchema)
  .query(async ({ input }) => {
    const { ruleId } = input;

    const rule = await prisma.adminRule.findFirst({
      where: {
        id: ruleId,
      },
    });

    if (!rule) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Rule not found' });
    }

    const [ruleListItem] = await getAdminRuleListItems([rule]);

    return ruleListItem;
  });
