import { useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { OrganisationMemberRole } from '@prisma/client';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { match } from 'ts-pattern';
import type { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '@documenso/lib/types/subscription';
import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import type { TGetAdminOrganisationResponse } from '@documenso/trpc/server/admin-router/get-admin-organisation.types';
import { ZUpdateAdminOrganisationRequestSchema } from '@documenso/trpc/server/admin-router/update-admin-organisation.types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { AdminOrganisationMemberDeleteDialog } from '~/components/dialogs/admin-organisation-member-delete-dialog';
import { AdminOrganisationMemberUpdateDialog } from '~/components/dialogs/admin-organisation-member-update-dialog';
import { DetailsCard, DetailsValue } from '~/components/general/admin-details';
import { AdminGlobalSettingsSection } from '~/components/general/admin-global-settings-section';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/organisations.$id';

export function loader() {
  return {};
}

export default function OrganisationGroupSettingsPage({ params }: Route.ComponentProps) {
  const { i18n, t } = useLingui();

  const organisationId = params.id;

  const { data: organisation, isLoading: isLoadingOrganisation } =
    trpc.admin.organisation.get.useQuery({
      organisationId,
    });

  const teamsColumns = useMemo(() => {
    return [
      {
        header: t`Team`,
        accessorKey: 'name',
        cell: ({ row }) => (
          <Link className="font-medium hover:underline" to={`/admin/teams/${row.original.id}`}>
            {row.original.name}
          </Link>
        ),
      },
      {
        header: t`Team ID`,
        accessorKey: 'id',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.id}</span>
        ),
      },
      {
        header: t`Team url`,
        accessorKey: 'url',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.url}</span>,
      },
      {
        header: t`Created`,
        accessorKey: 'createdAt',
        cell: ({ row }) => {
          return (
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {i18n.date(row.original.createdAt)}
            </span>
          );
        },
      },
    ] satisfies DataTableColumnDef<TGetAdminOrganisationResponse['teams'][number]>[];
  }, [i18n, t]);

  const organisationMembersColumns = useMemo(() => {
    if (!organisation) {
      return [];
    }

    return [
      {
        header: t`Member`,
        cell: ({ row }) => (
          <div className="space-y-1">
            <Link
              className="font-medium hover:underline"
              to={`/admin/users/${row.original.user.id}`}
            >
              {row.original.user.name ?? row.original.user.email}
            </Link>
            {row.original.user.name && (
              <div className="font-mono text-xs text-muted-foreground">
                {row.original.user.email}
              </div>
            )}
          </div>
        ),
      },
      {
        header: t`User ID`,
        accessorKey: 'userId',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.userId}</span>
        ),
      },
      {
        header: t`Role`,
        cell: ({ row }) => {
          const isOwner = row.original.userId === organisation.ownerUserId;

          if (isOwner) {
            return <Badge>{t`Owner`}</Badge>;
          }

          const highestRole = getHighestOrganisationRoleInGroup(
            row.original.organisationGroupMembers.map((ogm) => ogm.group),
          );

          const roleLabel = match(highestRole)
            .with(OrganisationMemberRole.ADMIN, () => t`Admin`)
            .with(OrganisationMemberRole.MANAGER, () => t`Manager`)
            .with(OrganisationMemberRole.MEMBER, () => t`Member`)
            .exhaustive();

          return <Badge variant="secondary">{roleLabel}</Badge>;
        },
      },
      {
        header: t`Joined`,
        accessorKey: 'createdAt',
        cell: ({ row }) => {
          return (
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {i18n.date(row.original.createdAt)}
            </span>
          );
        },
      },
      {
        header: t`Actions`,
        cell: ({ row }) => {
          const isOwner = row.original.userId === organisation.ownerUserId;

          const memberName = row.original.user.name ?? row.original.user.email;

          return (
            <div className="flex justify-end space-x-2">
              <AdminOrganisationMemberUpdateDialog
                trigger={
                  <Button variant="outline">
                    <Trans>Update role</Trans>
                  </Button>
                }
                organisationId={organisationId}
                organisationMember={row.original}
                isOwner={isOwner}
              />

              {!isOwner && (
                <AdminOrganisationMemberDeleteDialog
                  organisationId={organisationId}
                  organisationName={organisation.name}
                  organisationMemberId={row.original.id}
                  organisationMemberName={memberName}
                  organisationMemberEmail={row.original.user.email}
                />
              )}
            </div>
          );
        },
      },
    ] satisfies DataTableColumnDef<TGetAdminOrganisationResponse['members'][number]>[];
  }, [organisation, i18n, t]);

  if (isLoadingOrganisation) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organisation) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Organisation not found`,
            subHeading: msg`404 Organisation not found`,
            message: msg`The organisation you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/admin/organisations`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return (
    <div>
      <SettingsHeader
        title={t`Manage organisation`}
        subtitle={t`Manage the ${organisation.name} organisation`}
      >
        <Button variant="outline" asChild>
          <Link to={`/admin/organisation-insights/${organisationId}`}>
            <Trans>View insights</Trans>
          </Link>
        </Button>
      </SettingsHeader>

      <GenericOrganisationAdminForm organisation={organisation} />

      <div className="mt-6 rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              <Trans>Organisation usage</Trans>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <Trans>Current usage against organisation limits.</Trans>
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <DetailsCard label={<Trans>Members</Trans>}>
            <DetailsValue>
              {organisation.members.length} /{' '}
              {organisation.organisationClaim.memberCount === 0
                ? t`Unlimited`
                : organisation.organisationClaim.memberCount}
            </DetailsValue>
          </DetailsCard>

          <DetailsCard label={<Trans>Teams</Trans>}>
            <DetailsValue>
              {organisation.teams.length} /{' '}
              {organisation.organisationClaim.teamCount === 0
                ? t`Unlimited`
                : organisation.organisationClaim.teamCount}
            </DetailsValue>
          </DetailsCard>
        </div>
      </div>

      <div className="mt-6 rounded-lg border p-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="global-settings" className="border-b-0">
            <AccordionTrigger className="py-0">
              <div className="text-left">
                <p className="text-sm font-medium">
                  <Trans>Global Settings</Trans>
                </p>
                <p className="mt-1 text-sm font-normal text-muted-foreground">
                  <Trans>Default settings applied to this organisation.</Trans>
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="mt-4">
                <AdminGlobalSettingsSection settings={organisation.organisationGlobalSettings} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <OrganisationClaimsForm organisation={organisation} />

      <div className="mt-16 space-y-10">
        <div>
          <label className="text-sm font-medium leading-none">
            <Trans>Organisation Members</Trans>
          </label>

          <div className="my-2">
            <DataTable columns={organisationMembersColumns} data={organisation.members} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium leading-none">
            <Trans>Organisation Teams</Trans>
          </label>

          <div className="my-2">
            <DataTable columns={teamsColumns} data={organisation.teams} />
          </div>
        </div>
      </div>
    </div>
  );
}

const ZUpdateGenericOrganisationDataFormSchema =
  ZUpdateAdminOrganisationRequestSchema.shape.data.pick({
    name: true,
    url: true,
  });

type TUpdateGenericOrganisationDataFormSchema = z.infer<
  typeof ZUpdateGenericOrganisationDataFormSchema
>;

type OrganisationAdminFormOptions = {
  organisation: TGetAdminOrganisationResponse;
};

const GenericOrganisationAdminForm = ({ organisation }: OrganisationAdminFormOptions) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const { mutateAsync: updateOrganisation } = trpc.admin.organisation.update.useMutation();

  const form = useForm<TUpdateGenericOrganisationDataFormSchema>({
    resolver: zodResolver(ZUpdateGenericOrganisationDataFormSchema),
    defaultValues: {
      name: organisation.name,
      url: organisation.url,
    },
  });

  const onSubmit = async (data: TUpdateGenericOrganisationDataFormSchema) => {
    try {
      await updateOrganisation({
        organisationId: organisation.id,
        data,
      });

      toast({
        title: t`Success`,
        description: t`Organisation has been updated successfully`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: t`An error occurred`,
        description: t`We couldn't update the organisation. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                <Trans>Organisation Name</Trans>
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                <Trans>Organisation URL</Trans>
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              {!form.formState.errors.url && (
                <span className="text-xs font-normal text-foreground/50">
                  {field.value ? (
                    `${NEXT_PUBLIC_WEBAPP_URL()}/o/${field.value}`
                  ) : (
                    <Trans>A unique URL to identify the organisation</Trans>
                  )}
                </span>
              )}

              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting}>
            <Trans>Update</Trans>
          </Button>
        </div>
      </form>
    </Form>
  );
};

const ZUpdateOrganisationClaimsFormSchema = ZUpdateAdminOrganisationRequestSchema.shape.data.pick({
  claims: true,
});

type TUpdateOrganisationClaimsFormSchema = z.infer<typeof ZUpdateOrganisationClaimsFormSchema>;

const OrganisationClaimsForm = ({ organisation }: OrganisationAdminFormOptions) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const { mutateAsync: updateOrganisation } = trpc.admin.organisation.update.useMutation();

  const form = useForm<TUpdateOrganisationClaimsFormSchema>({
    resolver: zodResolver(ZUpdateOrganisationClaimsFormSchema),
    defaultValues: {
      claims: {
        teamCount: organisation.organisationClaim.teamCount,
        memberCount: organisation.organisationClaim.memberCount,
        envelopeItemCount: organisation.organisationClaim.envelopeItemCount,
        flags: organisation.organisationClaim.flags,
      },
    },
  });

  const onSubmit = async (values: TUpdateOrganisationClaimsFormSchema) => {
    try {
      await updateOrganisation({
        organisationId: organisation.id,
        data: values,
      });

      toast({
        title: t`Success`,
        description: t`Organisation has been updated successfully`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: t`An error occurred`,
        description: t`We couldn't update the organisation. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
        <FormField
          control={form.control}
          name="claims.teamCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Team Count</Trans>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                />
              </FormControl>
              <FormDescription>
                <Trans>Number of teams allowed. 0 = Unlimited</Trans>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="claims.memberCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Member Count</Trans>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                />
              </FormControl>
              <FormDescription>
                <Trans>Number of members allowed. 0 = Unlimited</Trans>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="claims.envelopeItemCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Envelope Item Count</Trans>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                />
              </FormControl>
              <FormDescription>
                <Trans>Maximum number of uploaded files per envelope allowed</Trans>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>
            <Trans>Feature Flags</Trans>
          </FormLabel>

          <div className="mt-2 space-y-2 rounded-md border p-4">
            {Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).map(({ key, label }) => {
              return (
                <FormField
                  key={key}
                  control={form.control}
                  name={`claims.flags.${key}`}
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <div className="flex items-center">
                          <Checkbox
                            id={`flag-${key}`}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />

                          <label
                            className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
                            htmlFor={`flag-${key}`}
                          >
                            {label}
                          </label>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting}>
            <Trans>Update</Trans>
          </Button>
        </div>
      </form>
    </Form>
  );
};
