import { useMemo } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';

export const UserBillingOrganisationsTable = () => {
  const { t } = useLingui();
  const { organisations } = useSession();

  const billingOrganisations = useMemo(() => {
    return organisations.filter((org) =>
      canExecuteOrganisationAction('MANAGE_BILLING', org.currentOrganisationRole),
    );
  }, [organisations]);

  const getSubscriptionStatusDisplay = (status: SubscriptionStatus | undefined) => {
    return match(status)
      .with(SubscriptionStatus.ACTIVE, () => ({
        label: t({ message: `Active`, context: `Subscription status` }),
        variant: 'default' as const,
      }))
      .with(SubscriptionStatus.PAST_DUE, () => ({
        label: t({ message: `Past Due`, context: `Subscription status` }),
        variant: 'warning' as const,
      }))
      .with(SubscriptionStatus.INACTIVE, () => ({
        label: t({ message: `Inactive`, context: `Subscription status` }),
        variant: 'neutral' as const,
      }))
      .otherwise(() => ({
        label: t({ message: `Free`, context: `Subscription status` }),
        variant: 'neutral' as const,
      }));
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`Organisation`,
        accessorKey: 'name',
        cell: ({ row }) => (
          <Link to={`/o/${row.original.url}`} preventScrollReset={true}>
            <AvatarWithText
              avatarSrc={formatAvatarUrl(row.original.avatarImageId)}
              avatarClass="h-12 w-12"
              avatarFallback={row.original.name.slice(0, 1).toUpperCase()}
              primaryText={
                <span className="text-foreground/80 font-semibold">{row.original.name}</span>
              }
              secondaryText={`${NEXT_PUBLIC_WEBAPP_URL()}/o/${row.original.url}`}
            />
          </Link>
        ),
      },
      {
        header: t`Subscription Status`,
        accessorKey: 'subscription',
        cell: ({ row }) => {
          const subscription = row.original.subscription;
          const status = subscription?.status;
          const { label, variant } = getSubscriptionStatusDisplay(status);

          return <Badge variant={variant}>{label}</Badge>;
        },
      },
      {
        header: t`Actions`,
        id: 'actions',
        cell: ({ row }) => (
          <Button asChild variant="outline">
            <Link to={`/o/${row.original.url}/settings/billing`}>
              <Trans>Manage Billing</Trans>
            </Link>
          </Button>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof billingOrganisations)[number]>[];
  }, [billingOrganisations]);

  if (billingOrganisations.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm">
          <Trans>You don't manage billing for any organisations.</Trans>
        </p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={billingOrganisations}
      perPage={billingOrganisations.length}
      currentPage={1}
      totalPages={1}
    />
  );
};
