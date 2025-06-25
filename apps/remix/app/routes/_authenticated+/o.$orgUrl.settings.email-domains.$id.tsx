import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { EditIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { generateDkimRecord } from '@documenso/lib/utils/emails';
import { trpc } from '@documenso/trpc/react';
import type { TGetOrganisationEmailDomainResponse } from '@documenso/trpc/server/organisation-router/get-organisation-email-domain.types';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { OrganisationEmailCreateDialog } from '~/components/dialogs/organisation-email-create-dialog';
import { OrganisationEmailDeleteDialog } from '~/components/dialogs/organisation-email-delete-dialog';
import { OrganisationEmailDomainDeleteDialog } from '~/components/dialogs/organisation-email-domain-delete-dialog';
import { OrganisationEmailUpdateDialog } from '~/components/dialogs/organisation-email-update-dialog';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/o.$orgUrl.settings.groups.$id';

export default function OrganisationEmailSettingsPage({ params }: Route.ComponentProps) {
  const { t } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const emailDomainId = params.id;

  const { data: emailDomain, isLoading: isLoadingEmailDomain } =
    trpc.organisation.emailDomain.get.useQuery(
      {
        emailDomainId,
      },
      {
        enabled: !!emailDomainId,
      },
    );

  const emailColumns = useMemo(() => {
    return [
      {
        header: t`Name`,
        accessorKey: 'emailName',
      },
      {
        header: t`Email`,
        accessorKey: 'email',
      },
      {
        header: t`Reply To`,
        accessorKey: 'replyTo',
      },

      {
        header: t`Actions`,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <MoreHorizontalIcon className="text-muted-foreground h-5 w-5" />
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-52" align="start" forceMount>
              <DropdownMenuLabel>
                <Trans>Actions</Trans>
              </DropdownMenuLabel>

              <OrganisationEmailUpdateDialog
                organisationEmail={row.original}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <EditIcon className="mr-2 h-4 w-4" />
                    <Trans>Update</Trans>
                  </DropdownMenuItem>
                }
              />

              <OrganisationEmailDeleteDialog
                emailId={row.original.id}
                email={row.original.email}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Trash2Icon className="mr-2 h-4 w-4" />
                    <Trans>Remove</Trans>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ] satisfies DataTableColumnDef<TGetOrganisationEmailDomainResponse['emails'][number]>[];
  }, [organisation]);

  if (isLoadingEmailDomain) {
    return <SpinnerBox className="py-32" />;
  }

  // Todo: Update UI, currently out of place.
  if (!emailDomain) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Email domain not found`,
            subHeading: msg`404 Email domain not found`,
            message: msg`The email domain you are looking for may have been removed, renamed or may have never
                    existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/o/${organisation.url}/settings/email-domains`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  const dkimRecord = generateDkimRecord(
    emailDomain.domain,
    emailDomain.selector,
    emailDomain.publicKey,
  );

  return (
    <div>
      <SettingsHeader
        title={t`Email Domain Settings`}
        subtitle={t`Manage your email domain settings.`}
      >
        <OrganisationEmailCreateDialog emailDomain={emailDomain} />
      </SettingsHeader>

      <div className="mt-4">
        <label className="text-sm font-medium leading-none">
          <Trans>Emails</Trans>
        </label>

        <div className="my-2">
          <DataTable columns={emailColumns} data={emailDomain.emails} />
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-md border p-4">
        <div className="space-y-2">
          <Label>
            <Trans>Domain</Trans>
          </Label>

          <div className="relative">
            <Input className="pr-12" disabled value={emailDomain.domain} />
            <div className="absolute bottom-0 right-2 top-0 flex items-center justify-center">
              <CopyTextButton
                value={emailDomain.domain}
                onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            <Trans>Record Name</Trans>
          </Label>

          <div className="relative">
            <Input className="pr-12" disabled value={dkimRecord.name} />
            <div className="absolute bottom-0 right-2 top-0 flex items-center justify-center">
              <CopyTextButton
                value={dkimRecord.name}
                onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            <Trans>Record Value</Trans>
          </Label>

          <div className="relative">
            <Input className="pr-12" disabled value={dkimRecord.value} />
            <div className="absolute bottom-0 right-2 top-0 flex items-center justify-center">
              <CopyTextButton
                value={dkimRecord.value}
                onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
              />
            </div>
          </div>
        </div>
      </div>

      <Alert
        className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 sm:mb-0">
          <AlertTitle>
            <Trans>Delete email domain</Trans>
          </AlertTitle>

          <AlertDescription className="mr-2">
            <Trans>This will remove all emails associated with this email domain</Trans>
          </AlertDescription>
        </div>

        <OrganisationEmailDomainDeleteDialog
          emailDomainId={emailDomainId}
          emailDomain={emailDomain.domain}
          trigger={
            <Button variant="destructive" title={t`Remove email domain`}>
              <Trans>Delete Email Domain</Trans>
            </Button>
          }
        />
      </Alert>
    </div>
  );
}
