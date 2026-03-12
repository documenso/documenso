import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EmailDomainStatus } from '@prisma/client';
import { CheckCircle2Icon, ClockIcon, CopyIcon, RotateCcwIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link, redirect } from 'react-router';
import { match } from 'ts-pattern';

import { generateEmailDomainRecords } from '@documenso/lib/utils/email-domains';
import { trpc } from '@documenso/trpc/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@documenso/ui/primitives/alert-dialog';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { useToast } from '@documenso/ui/primitives/use-toast';

import type { Route } from './+types/email-domains.$id';

export function loader({ params }: Route.LoaderArgs) {
  const id = params.id;

  if (!id) {
    throw redirect('/admin/email-domains');
  }

  return { emailDomainId: id };
}

export default function AdminEmailDomainDetailPage({ loaderData }: Route.ComponentProps) {
  const { emailDomainId } = loaderData;

  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const {
    data: emailDomain,
    isPending: isLoading,
    refetch,
  } = trpc.admin.emailDomain.get.useQuery({ emailDomainId });

  const { mutate: reregisterDomain, isPending: isReregistering } =
    trpc.admin.emailDomain.reregister.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Domain re-registered`),
          description: _(
            msg`The SES identity has been deleted and recreated with the same keys. DNS records remain unchanged.`,
          ),
        });

        void refetch();
      },
      onError: () => {
        toast({
          title: _(msg`Error`),
          description: _(msg`Failed to re-register email domain`),
          variant: 'destructive',
        });
      },
    });

  const dnsRecords = useMemo(() => {
    if (!emailDomain) {
      return [];
    }

    return generateEmailDomainRecords(emailDomain.selector, emailDomain.publicKey);
  }, [emailDomain]);

  const emailColumns = useMemo(() => {
    return [
      {
        header: _(msg`Email`),
        accessorKey: 'email',
      },
      {
        header: _(msg`Display Name`),
        accessorKey: 'emailName',
      },
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
    ] satisfies DataTableColumnDef<NonNullable<typeof emailDomain>['emails'][number]>[];
  }, []);

  const onCopyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);

    toast({
      title: _(msg`Copied to clipboard`),
    });
  };

  if (isLoading || !emailDomain) {
    return (
      <div>
        <h2 className="text-4xl font-semibold">
          <Trans>Email Domain</Trans>
        </h2>
        <p className="mt-4 text-muted-foreground">
          <Trans>Loading...</Trans>
        </p>
      </div>
    );
  }

  const pendingDuration =
    emailDomain.status === EmailDomainStatus.PENDING
      ? DateTime.fromJSDate(new Date(emailDomain.createdAt)).toRelative()
      : null;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-x-4">
          <h2 className="text-2xl font-semibold">{emailDomain.domain}</h2>

          {match(emailDomain.status)
            .with(EmailDomainStatus.ACTIVE, () => (
              <Badge>
                <CheckCircle2Icon className="mr-2 h-4 w-4 text-green-500 dark:text-green-300" />
                <Trans>Active</Trans>
              </Badge>
            ))
            .with(EmailDomainStatus.PENDING, () => (
              <Badge variant="warning">
                <ClockIcon className="mr-2 h-4 w-4 text-yellow-500 dark:text-yellow-200" />
                <Trans>Pending</Trans>
              </Badge>
            ))
            .exhaustive()}
        </div>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        <div>
          <Trans>ID</Trans>: {emailDomain.id}
        </div>
        <div>
          <Trans>Organisation</Trans>:{' '}
          <Link
            to={`/admin/organisations/${emailDomain.organisation.id}`}
            className="hover:underline"
          >
            {emailDomain.organisation.name}
          </Link>
        </div>
        <div>
          <Trans>Selector</Trans>: {emailDomain.selector}
        </div>
        <div>
          <Trans>Created</Trans>: {i18n.date(emailDomain.createdAt, DateTime.DATETIME_MED)}
        </div>
        <div>
          <Trans>Last Verified</Trans>:{' '}
          {emailDomain.lastVerifiedAt
            ? i18n.date(emailDomain.lastVerifiedAt, DateTime.DATETIME_MED)
            : '-'}
        </div>
        {pendingDuration && (
          <div className="mt-1 text-yellow-600 dark:text-yellow-400">
            <Trans>Pending since</Trans>: {pendingDuration}
          </div>
        )}
      </div>

      <hr className="my-4" />

      <h3 className="text-lg font-semibold">
        <Trans>Admin Actions</Trans>
      </h3>

      <div className="mt-2 flex gap-x-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" loading={isReregistering}>
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              <Trans>Re-register</Trans>
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Re-register Email Domain</Trans>
              </AlertDialogTitle>

              <AlertDialogDescription>
                <Trans>
                  This will delete the existing SES identity for{' '}
                  <strong>{emailDomain.domain}</strong> and recreate it using the same DKIM keys.
                  The user will not need to update their DNS records. The domain status will be
                  reset to Pending.
                </Trans>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Cancel</Trans>
              </AlertDialogCancel>

              <AlertDialogAction
                onClick={() => reregisterDomain({ emailDomainId: emailDomain.id })}
              >
                <Trans>Re-register</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <hr className="my-4" />

      <h3 className="text-lg font-semibold">
        <Trans>DNS Records</Trans>
      </h3>

      <div className="mt-4 space-y-4">
        {dnsRecords.map((record, index) => (
          <div key={index} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {record.type} <Trans>Record</Trans>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onCopyToClipboard(record.value)}
              >
                <CopyIcon className="mr-2 h-4 w-4" />
                <Trans>Copy Value</Trans>
              </Button>
            </div>

            <div className="mt-2 space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">
                  <Trans>Name</Trans>:{' '}
                </span>
                <code className="rounded bg-muted px-1 py-0.5">{record.name}</code>
              </div>
              <div>
                <span className="text-muted-foreground">
                  <Trans>Value</Trans>:{' '}
                </span>
                <code className="block break-all rounded bg-muted px-1 py-0.5">{record.value}</code>
              </div>
            </div>
          </div>
        ))}
      </div>

      <hr className="my-4" />

      <h3 className="text-lg font-semibold">
        <Trans>Emails</Trans> ({emailDomain.emails.length})
      </h3>

      <div className="mt-4">
        {emailDomain.emails.length > 0 ? (
          <DataTable
            columns={emailColumns}
            data={emailDomain.emails}
            perPage={emailDomain.emails.length}
            currentPage={1}
            totalPages={1}
            onPaginationChange={() => {}}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            <Trans>No emails configured for this domain.</Trans>
          </p>
        )}
      </div>
    </div>
  );
}
