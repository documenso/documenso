import { getTeamInvoices } from '@documenso/ee/server-only/stripe/get-team-invoices';
import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';

export interface FindTeamInvoicesOptions {
  userId: number;
  teamId: number;
}

export const findTeamInvoices = async ({ userId, teamId }: FindTeamInvoicesOptions) => {
  await prisma.team.findUniqueOrThrow({
    where: {
      id: teamId,
      members: {
        some: {
          userId,
          role: {
            in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
          },
        },
      },
    },
  });

  const results = await getTeamInvoices({ teamId });

  if (!results) {
    return null;
  }

  return {
    ...results,
    data: results.data.map((invoice) => ({
      invoicePdf: invoice.invoice_pdf,
      hostedInvoicePdf: invoice.hosted_invoice_url,
      status: invoice.status,
      subtotal: invoice.subtotal,
      total: invoice.total,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      created: invoice.created,
      paid: invoice.paid,
      quantity: invoice.lines.data[0].quantity ?? 0,
      currency: invoice.currency,
    })),
  };
};
