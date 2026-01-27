import { useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon, InfoIcon, Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import type { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { SUBSCRIPTION_STATUS_MAP } from '@documenso/lib/constants/billing';
import { AppError } from '@documenso/lib/errors/app-error';
import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '@documenso/lib/types/subscription';
import { trpc } from '@documenso/trpc/react';
import type { TGetAdminOrganisationResponse } from '@documenso/trpc/server/admin-router/get-admin-organisation.types';
import { ZUpdateAdminOrganisationRequestSchema } from '@documenso/trpc/server/admin-router/update-admin-organisation.types';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { AdminOrganisationMemberUpdateDialog } from '~/components/dialogs/admin-organisation-member-update-dialog';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/organisations.$id';

export default function OrganisationGroupSettingsPage({ params }: Route.ComponentProps) {
  const { t } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const organisationId = params.id;

  const { data: organisation, isLoading: isLoadingOrganisation } =
    trpc.admin.organisation.get.useQuery({
      organisationId,
    });

  const { mutateAsync: createStripeCustomer, isPending: isCreatingStripeCustomer } =
    trpc.admin.stripe.createCustomer.useMutation({
      onSuccess: async () => {
        await navigate(0);

        toast({
          title: t`Success`,
          description: t`Stripe customer created successfully`,
        });
      },
      onError: () => {
        toast({
          title: t`Error`,
          description: t`We couldn't create a Stripe customer. Please try again.`,
          variant: 'destructive',
        });
      },
    });

  const teamsColumns = useMemo(() => {
    return [
      {
        header: t`Team`,
        accessorKey: 'name',
      },
      {
        header: t`Team url`,
        accessorKey: 'url',
      },
    ] satisfies DataTableColumnDef<TGetAdminOrganisationResponse['teams'][number]>[];
  }, []);

  const organisationMembersColumns = useMemo(() => {
    return [
      {
        header: t`Member`,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link to={`/admin/users/${row.original.user.id}`}>{row.original.user.name}</Link>
            {row.original.user.id === organisation?.ownerUserId && <Badge>Owner</Badge>}
          </div>
        ),
      },
      {
        header: t`Email`,
        cell: ({ row }) => (
          <Link to={`/admin/users/${row.original.user.id}`}>{row.original.user.email}</Link>
        ),
      },
      {
        header: t`Actions`,
        cell: ({ row }) => {
          const isOwner = row.original.userId === organisation?.ownerUserId;

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
            </div>
          );
        },
      },
    ] satisfies DataTableColumnDef<TGetAdminOrganisationResponse['members'][number]>[];
  }, [organisation]);

  if (isLoadingOrganisation) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
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

      <SettingsHeader
        title={t`Manage subscription`}
        subtitle={t`Manage the ${organisation.name} organisation subscription`}
        className="mt-16"
      />

      <Alert
        className="my-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 sm:mb-0">
          <AlertTitle>
            <Trans>Subscription</Trans>
          </AlertTitle>

          <AlertDescription className="mr-2">
            {organisation.subscription ? (
              <span>
                {SUBSCRIPTION_STATUS_MAP[organisation.subscription.status]} subscription found
              </span>
            ) : (
              <span>No subscription found</span>
            )}
          </AlertDescription>
        </div>

        {!organisation.customerId && (
          <div>
            <Button
              variant="outline"
              loading={isCreatingStripeCustomer}
              onClick={async () => createStripeCustomer({ organisationId })}
            >
              <Trans>Create Stripe customer</Trans>
            </Button>
          </div>
        )}

        {organisation.customerId && !organisation.subscription && (
          <div>
            <Button variant="outline" asChild>
              <Link
                target="_blank"
                to={`https://dashboard.stripe.com/customers/${organisation.customerId}?create=subscription&subscription_default_customer=${organisation.customerId}`}
              >
                <Trans>Create subscription</Trans>
                <ExternalLinkIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {organisation.subscription && (
          <div>
            <Button variant="outline" asChild>
              <Link
                target="_blank"
                to={`https://dashboard.stripe.com/subscriptions/${organisation.subscription.planId}`}
              >
                <Trans>Manage subscription</Trans>
                <ExternalLinkIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </Alert>

      <OrganisationAdminForm organisation={organisation} />

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
                <span className="text-foreground/50 text-xs font-normal">
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

const ZUpdateOrganisationBillingFormSchema = ZUpdateAdminOrganisationRequestSchema.shape.data.pick({
  claims: true,
  customerId: true,
  originalSubscriptionClaimId: true,
});

type TUpdateOrganisationBillingFormSchema = z.infer<typeof ZUpdateOrganisationBillingFormSchema>;

const OrganisationAdminForm = ({ organisation }: OrganisationAdminFormOptions) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const { mutateAsync: updateOrganisation } = trpc.admin.organisation.update.useMutation();

  const form = useForm<TUpdateOrganisationBillingFormSchema>({
    resolver: zodResolver(ZUpdateOrganisationBillingFormSchema),
    defaultValues: {
      customerId: organisation.customerId || '',
      claims: {
        teamCount: organisation.organisationClaim.teamCount,
        memberCount: organisation.organisationClaim.memberCount,
        envelopeItemCount: organisation.organisationClaim.envelopeItemCount,
        flags: organisation.organisationClaim.flags,
      },
      originalSubscriptionClaimId: organisation.organisationClaim.originalSubscriptionClaimId || '',
    },
  });

  const onSubmit = async (values: TUpdateOrganisationBillingFormSchema) => {
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="originalSubscriptionClaimId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center">
                <Trans>Inherited subscription claim</Trans>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="mx-2 h-4 w-4" />
                  </TooltipTrigger>

                  <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
                    <h2>
                      <strong>
                        <Trans>Inherited subscription claim</Trans>
                      </strong>
                    </h2>

                    <p>
                      <Trans>
                        This is the claim that this organisation was initially created with. Any
                        feature flag changes to this claim will be backported into this
                        organisation.
                      </Trans>
                    </p>

                    <p>
                      <Trans>
                        For example, if the claim has a new flag "FLAG_1" set to true, then this
                        organisation will get that flag added.
                      </Trans>
                    </p>
                    <p>
                      <Trans>
                        This will ONLY backport feature flags which are set to true, anything
                        disabled in the initial claim will not be backported
                      </Trans>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </FormLabel>
              <FormControl>
                <Input disabled {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                <Trans>Stripe Customer ID</Trans>
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t`No Stripe customer attached`} />
              </FormControl>
              {!form.formState.errors.customerId && field.value && (
                <Link
                  target="_blank"
                  to={`https://dashboard.stripe.com/customers/${field.value}`}
                  className="text-foreground/50 text-xs font-normal"
                >
                  {`https://dashboard.stripe.com/customers/${field.value}`}
                </Link>
              )}

              <FormMessage />
            </FormItem>
          )}
        />

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
            {Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).map(({ key, label }) => (
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
                          className="text-muted-foreground ml-2 flex flex-row items-center text-sm"
                          htmlFor={`flag-${key}`}
                        >
                          {label}
                        </label>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
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
