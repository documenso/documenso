import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { validateAdminRuleDefinition, validateAdminRuleExemptions } from '@documenso/lib/utils/admin-rules';
import { prisma } from '@documenso/prisma';
import { AdminRuleMode } from '@prisma/client';

import { adminProcedure } from '../../trpc';
import { ZUpdateAdminRuleRequestSchema, ZUpdateAdminRuleResponseSchema } from './update-admin-rule.types';

export const updateAdminRuleRoute = adminProcedure
  .input(ZUpdateAdminRuleRequestSchema)
  .output(ZUpdateAdminRuleResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { ruleId, data } = input;

    ctx.logger.info({
      input: {
        ruleId,
        mode: data.mode,
      },
    });

    const rule = await prisma.adminRule.findFirst({
      where: {
        id: ruleId,
      },
    });

    if (!rule) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Rule not found' });
    }

    const trigger = data.trigger ?? rule.trigger;

    // Only re-check what this update touches. A rule that no longer validates can still be renamed or
    // switched off, but it has to be fixed before it can be switched to an active mode.
    const isChangingLogic = data.trigger !== undefined || data.definition !== undefined;
    const isActivating = data.mode !== undefined && data.mode !== AdminRuleMode.DISABLED;

    if (isChangingLogic || isActivating) {
      validateAdminRuleDefinition(trigger, data.definition ?? rule.definition);
    }

    if (data.trigger !== undefined || data.exemptOrganisationIds !== undefined) {
      validateAdminRuleExemptions(trigger, data.exemptOrganisationIds ?? rule.exemptOrganisationIds);
    }

    const updatedRule = await prisma.adminRule.update({
      where: {
        id: ruleId,
      },
      data: {
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        mode: data.mode,
        stopOnMatch: data.stopOnMatch,
        definition: data.definition,
        exemptOrganisationIds: data.exemptOrganisationIds,
      },
    });

    return updatedRule;
  });
