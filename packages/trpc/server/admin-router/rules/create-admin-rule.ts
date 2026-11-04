import { generateDatabaseId } from '@documenso/lib/universal/id';
import { validateAdminRuleDefinition, validateAdminRuleExemptions } from '@documenso/lib/utils/admin-rules';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import { ZCreateAdminRuleRequestSchema, ZCreateAdminRuleResponseSchema } from './create-admin-rule.types';

export const createAdminRuleRoute = adminProcedure
  .input(ZCreateAdminRuleRequestSchema)
  .output(ZCreateAdminRuleResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name, description, trigger, mode, stopOnMatch, definition, exemptOrganisationIds } = input;

    ctx.logger.info({
      input: {
        name,
        trigger,
        mode,
      },
    });

    validateAdminRuleDefinition(trigger, definition);
    validateAdminRuleExemptions(trigger, exemptOrganisationIds);

    const lastRule = await prisma.adminRule.findFirst({
      orderBy: {
        priority: 'desc',
      },
      select: {
        priority: true,
      },
    });

    const rule = await prisma.adminRule.create({
      data: {
        id: generateDatabaseId('admin_rule'),
        name,
        description,
        trigger,
        mode,
        stopOnMatch,
        definition,
        exemptOrganisationIds,
        priority: (lastRule?.priority ?? -1) + 1,
      },
    });

    return rule;
  });
