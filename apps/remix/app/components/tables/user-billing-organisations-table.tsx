import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { useToast } from '@documenso/ui/primitives/use-toast';

const BillingPortalButton = ({ organisationId }: { organisationId: string }) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: manageSubscription, isPending } =
    trpc.enterprise.billing.subscription.manage.useMutation();

  const handleOpenPortal = async () => {
    try {
      const { redirectUrl } = await manageSubscription({ organisationId });
      window.open(redirectUrl, '_blank');
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to access billing portal. Please try again.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <Button variant="outline" onClick={handleOpenPortal} loading={isPending}>
      <Trans>Manage Billing</Trans>
    </Button>
  );
};

export const UserBillingOrganisationsTable = () => {
  const { _ } = useLingui();
  const { organisations } = useSession();

  const billingOrganisations = useMemo(() => {
    return organisations.filter((org) =>
      canExecuteOrganisationAction('MANAGE_BILLING', org.currentOrganisationRole),
    );
  }, [organisations]);

  const getSubscriptionStatusDisplay = (status: SubscriptionStatus | undefined) => {
    return match(status)
      .with(SubscriptionStatus.ACTIVE, () => ({
        label: _(msg`Active`),
        variant: 'default' as const,
      }))
      .with(SubscriptionStatus.PAST_DUE, () => ({
        label: _(msg`Past Due`),
        variant: 'warning' as const,
      }))
      .with(SubscriptionStatus.INACTIVE, () => ({
        label: _(msg`Inactive`),
        variant: 'neutral' as const,
      }))
      .otherwise(() => ({
        label: _(msg`Free`),
        variant: 'neutral' as const,
      }));
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Organisation`),
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
        header: _(msg`Subscription Status`),
        accessorKey: 'subscription',
        cell: ({ row }) => {
          const subscription = row.original.subscription;
          const status = subscription?.status;
          const { label, variant } = getSubscriptionStatusDisplay(status);

          return <Badge variant={variant}>{label}</Badge>;
        },
      },
      {
        header: _(msg`Actions`),
        id: 'actions',
        cell: ({ row }) => <BillingPortalButton organisationId={row.original.id} />,
      },
    ] satisfies DataTableColumnDef<(typeof billingOrganisations)[number]>[];
  }, [_, billingOrganisations]);

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
