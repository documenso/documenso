import { getInvoices } from '@documenso/ee/server-only/stripe/get-invoices';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZGetInvoicesRequestSchema } from './get-invoices.types';

export const getInvoicesRoute = authenticatedProcedure
  .input(ZGetInvoicesRequestSchema)
  .query(async ({ ctx, input }) => {
    const { organisationId } = input;

    const userId = ctx.user.id;

    if (!IS_BILLING_ENABLED()) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Billing is not enabled',
      });
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        userId,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
      include: {
        subscription: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not authorized to access this organisation',
      });
    }

    if (!organisation.customerId) {
      return null;
    }

    const invoices = await getInvoices({
      customerId: organisation.customerId,
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      created: invoice.created,
      currency: invoice.currency,
      total: invoice.total,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
    }));
  });
