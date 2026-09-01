import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { prisma } from '@documenso/prisma';
import type { Prisma } from '@prisma/client';
import { match } from 'ts-pattern';

import { adminProcedure } from '../trpc';
import {
  ZResetOrganisationMonthlyStatRequestSchema,
  ZResetOrganisationMonthlyStatResponseSchema,
} from './reset-organisation-monthly-stat.types';

export const resetOrganisationMonthlyStatRoute = adminProcedure
  .input(ZResetOrganisationMonthlyStatRequestSchema)
  .output(ZResetOrganisationMonthlyStatResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, counter } = input;

    const period = currentMonthlyPeriod();

    ctx.logger.info({ organisationId, counter, period });

    const data: Prisma.OrganisationMonthlyStatUpdateInput = match(counter)
      .with('document', () => ({ documentCount: 0 }))
      .with('email', () => ({ emailCount: 0 }))
      .with('api', () => ({ apiCount: 0 }))
      .exhaustive();

    await prisma.organisationMonthlyStat.update({
      where: { organisationId_period: { organisationId, period } },
      data,
    });
  });
