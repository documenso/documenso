import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { SUBSCRIPTION_STATUS_MAP } from '@documenso/lib/constants/billing';
import { AppError } from '@documenso/lib/errors/app-error';
import { LicenseClient } from '@documenso/lib/server-only/license/license-client';
import type { TLicenseClaim } from '@documenso/lib/types/license';
import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '@documenso/lib/types/subscription';
import { trpc } from '@documenso/trpc/react';
import type { TGetAdminOrganisationResponse } from '@documenso/trpc/server/admin-router/get-admin-organisation.types';
import { ZUpdateAdminOrganisationRequestSchema } from '@documenso/trpc/server/admin-router/update-admin-organisation.types';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { CheckIcon, CopyIcon, ExternalLinkIcon, InfoIcon, Loader } from 'lucide-react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { AdminOrganisationDeleteDialog } from '~/components/dialogs/admin-organisation-delete-dialog';
import { AdminOrganisationSyncSubscriptionDialog } from '~/components/dialogs/admin-organisation-sync-subscription-dialog';
import { AdminGlobalSettingsSection } from '~/components/general/admin-global-settings-section';
import { ClaimLimitFields } from '~/components/general/claim-limit-fields';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { OrganisationUsageAlertDot, OrganisationUsagePanel } from '~/components/general/organisation-usage-panel';
import { useAdminOrganisationInsights } from '~/components/general/use-admin-organisation-insights';
import { AdminOrganisationDocumentsTable } from '~/components/tables/admin-organisation-documents-table';
import { AdminOrganisationMembersTable } from '~/components/tables/admin-organisation-members-table';
import { AdminOrganisationTeamsTable } from '~/components/tables/admin-organisation-teams-table';

import type { Route } from './+types/organisations.$id';

export async function loader() {
  const licenseData = await LicenseClient.getInstance()?.getCachedLicense();

  return {
    licenseFlags: licenseData?.license?.flags,
  };
}

export default function OrganisationGroupSettingsPage({ params, loaderData }: Route.ComponentProps) {
  const { licenseFlags } = loaderData;

  const { i18n, t } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const organisationId = params.id;

  const { data: organisation, isLoading: isLoadingOrganisation } = trpc.admin.organisation.get.useQuery(
    {
      organisationId,
    },
    {
      retry: false,
    },
  );

  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(ORGANISATION_TABS).withDefault('documents'));

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

  const usage = {
    monthlyStats: organisation.monthlyStats,
    organisationClaim: organisation.organisationClaim,
    memberCount: organisation.members.length,
    teamCount: organisation.teams.length,
  };

  return (
    <div className="space-y-6">
      <OrganisationHeader organisation={organisation} />

      <Tabs
        value={tab}
        onValueChange={(value) => void setTab(ORGANISATION_TABS.find((name) => name === value) ?? null)}
      >
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>
            <TabsTrigger value="documents">
              <Trans>Documents</Trans>
              <DocumentCount organisationId={organisationId} />
            </TabsTrigger>

            <TabsTrigger value="usage">
              <Trans>Usage</Trans>
              <OrganisationUsageAlertDot {...usage} />
            </TabsTrigger>

            <TabsTrigger value="teams">
              <Trans>Teams</Trans>
              <TabCount value={organisation.teams.length} />
            </TabsTrigger>

            <TabsTrigger value="members">
              <Trans>Members</Trans>
              <TabCount value={organisation.members.length} />
            </TabsTrigger>

            <TabsTrigger value="plan">
              <Trans>Plan and limits</Trans>
            </TabsTrigger>

            <TabsTrigger value="settings">
              <Trans>Settings</Trans>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="mt-5">
          <AdminOrganisationDocumentsTable organisationId={organisationId} />
        </TabsContent>

        <TabsContent value="usage" className="mt-5">
          <OrganisationUsagePanel organisationId={organisationId} {...usage} />
        </TabsContent>

        <TabsContent value="teams" className="mt-5">
          <AdminOrganisationTeamsTable organisation={organisation} />
        </TabsContent>

        <TabsContent value="members" className="mt-5">
          <AdminOrganisationMembersTable organisation={organisation} />
        </TabsContent>

        <TabsContent value="plan" className="mt-5 space-y-6">
          <Alert
            className={cn(
              'flex flex-col justify-between p-6 sm:flex-row sm:items-center',
              organisation.subscription?.status === SubscriptionStatus.ACTIVE &&
                'border border-green-600/20 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10',
              organisation.subscription?.status === SubscriptionStatus.INACTIVE && 'opacity-60',
            )}
            variant="neutral"
          >
            <div className="mb-4 sm:mb-0">
              <AlertTitle>
                <Trans>Subscription</Trans>
              </AlertTitle>

              <AlertDescription className="mr-2">
                {organisation.subscription ? (
                  <span className="flex items-center gap-2">
                    {organisation.subscription.status === SubscriptionStatus.ACTIVE && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-green-600 dark:bg-green-400"
                        aria-hidden="true"
                      />
                    )}
                    <span>{i18n._(SUBSCRIPTION_STATUS_MAP[organisation.subscription.status])} subscription found</span>
                  </span>
                ) : (
                  <span>
                    <Trans>No subscription found</Trans>
                  </span>
                )}
              </AlertDescription>
            </div>

            {!organisation.customerId && (
              <div>
                <Button
                  variant="outline"
                  className="bg-background"
                  loading={isCreatingStripeCustomer}
                  onClick={async () => createStripeCustomer({ organisationId })}
                >
                  <Trans>Create Stripe customer</Trans>
                </Button>
              </div>
            )}

            {organisation.customerId && !organisation.subscription && (
              <div>
                <Button variant="outline" className="bg-background" asChild>
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <AdminOrganisationSyncSubscriptionDialog
                  organisationId={organisationId}
                  trigger={
                    <Button variant="outline" className="bg-background">
                      <Trans>Sync Stripe subscription</Trans>
                    </Button>
                  }
                />

                <Button variant="outline" className="bg-background" asChild>
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

          <OrganisationAdminForm organisation={organisation} licenseFlags={licenseFlags} />
        </TabsContent>

        <TabsContent value="settings" className="mt-5 space-y-10">
          <GenericOrganisationAdminForm organisation={organisation} />

          <section>
            <h3 className="font-semibold text-base">
              <Trans>Global Settings</Trans>
            </h3>
            <p className="mt-1 text-muted-foreground text-sm">
              <Trans>Default settings applied to this organisation.</Trans>
            </p>

            <div className="mt-3">
              <AdminGlobalSettingsSection settings={organisation.organisationGlobalSettings} />
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base">
              <Trans>Danger Zone</Trans>
            </h3>
            <p className="mt-1 text-muted-foreground text-sm">
              <Trans>Irreversible actions for this organisation</Trans>
            </p>

            <Alert className="mt-3 flex flex-col justify-between p-6 sm:flex-row sm:items-center" variant="destructive">
              <div className="mb-4 sm:mb-0">
                <AlertTitle>
                  <Trans>Delete organisation</Trans>
                </AlertTitle>

                <AlertDescription className="mr-2">
                  <Trans>
                    Permanently delete this organisation. Documents will be orphaned (not deleted) so they remain
                    accessible via the deleted-account service account.
                  </Trans>
                </AlertDescription>
              </div>

              <div>
                <AdminOrganisationDeleteDialog organisationId={organisation.id} organisationName={organisation.name} />
              </div>
            </Alert>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const ORGANISATION_TABS = ['documents', 'usage', 'teams', 'members', 'plan', 'settings'] as const;

const TabCount = ({ value }: { value: number | undefined }) => (
  <span className="ml-2 inline-flex min-w-[2ch] justify-end text-muted-foreground text-xs tabular-nums">
    {value === undefined ? <Skeleton className="h-3 w-5" /> : value.toLocaleString()}
  </span>
);

// A component of its own, so insights load only after the page knows that the organisation exists.
// The loader throws for an unknown organisation, and that error would replace the not-found page.
const DocumentCount = ({ organisationId }: { organisationId: string }) => {
  const { insights } = useAdminOrganisationInsights({ organisationId, view: 'documents', perPage: 1 });

  return <TabCount value={insights?.summary?.totalDocuments} />;
};

const OrganisationHeader = ({ organisation }: { organisation: TGetAdminOrganisationResponse }) => {
  const { i18n, t } = useLingui();

  const [, copy] = useCopyToClipboard();
  const [isCopied, setIsCopied] = useState(false);

  const owner = organisation.members.find((member) => member.userId === organisation.ownerUserId);

  const status = organisation.subscription?.status;
  const statusLabel = status && i18n._(SUBSCRIPTION_STATUS_MAP[status]);

  // The copy icon turns into a check for a moment, so the click has a visible result.
  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timeout = setTimeout(() => setIsCopied(false), 1500);

    return () => clearTimeout(timeout);
  }, [isCopied]);

  return (
    <header className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 className="text-balance font-semibold text-2xl tracking-tight">{organisation.name}</h2>

        <Badge
          size="small"
          variant={
            status === SubscriptionStatus.ACTIVE
              ? 'default'
              : status === SubscriptionStatus.PAST_DUE
                ? 'destructive'
                : 'neutral'
          }
        >
          {statusLabel ? <Trans>{statusLabel} subscription</Trans> : <Trans>No subscription</Trans>}
        </Badge>
      </div>

      <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-muted-foreground text-sm">
        <div className="flex items-center gap-1">
          <dt className="sr-only">
            <Trans>ID</Trans>
          </dt>
          <dd className="font-mono text-xs">{organisation.id}</dd>

          <button
            type="button"
            aria-label={t`Copy organisation ID`}
            className="relative rounded-sm p-1 before:absolute before:-inset-2.5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/40"
            onClick={async () => setIsCopied(await copy(organisation.id))}
          >
            {isCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          </button>
        </div>

        {owner && (
          <div className="flex min-w-0 gap-1.5">
            <dt>
              <Trans>Owner</Trans>
            </dt>
            <dd className="min-w-0">
              <Link
                className="block max-w-64 truncate font-medium text-foreground hover:underline"
                to={`/admin/users/${owner.userId}`}
                title={owner.user.email}
              >
                {owner.user.name || owner.user.email}
              </Link>
            </dd>
          </div>
        )}

        <div className="flex gap-1.5">
          <dt>
            <Trans>Created</Trans>
          </dt>
          <dd className="text-foreground">{i18n.date(organisation.createdAt, { dateStyle: 'medium' })}</dd>
        </div>
      </dl>
    </header>
  );
};

const ZUpdateGenericOrganisationDataFormSchema = ZUpdateAdminOrganisationRequestSchema.shape.data.pick({
  name: true,
  url: true,
});

type TUpdateGenericOrganisationDataFormSchema = z.infer<typeof ZUpdateGenericOrganisationDataFormSchema>;

type OrganisationAdminFormOptions = {
  organisation: TGetAdminOrganisationResponse;
  licenseFlags?: TLicenseClaim;
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
                <span className="font-normal text-foreground/50 text-xs">
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

const ZUpdateOrganisationBillingFormSchema = ZUpdateAdminOrganisationRequestSchema.shape.data
  .pick({
    claims: true,
    customerId: true,
    originalSubscriptionClaimId: true,
  })
  .extend({
    notifyOrganisation: z.boolean(),
  });

type TUpdateOrganisationBillingFormSchema = z.infer<typeof ZUpdateOrganisationBillingFormSchema>;

const OrganisationAdminForm = ({ organisation, licenseFlags }: OrganisationAdminFormOptions) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const { mutateAsync: updateOrganisation } = trpc.admin.organisation.update.useMutation();

  const { data: transportsData } = trpc.admin.emailTransport.find.useQuery({ perPage: 100 });
  const transports = transportsData?.data ?? [];
  const NONE_VALUE = '__none__';

  const hasRestrictedEnterpriseFeatures = Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).some(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (flag) => flag.isEnterprise && !licenseFlags?.[flag.key as keyof TLicenseClaim],
  );

  const form = useForm<TUpdateOrganisationBillingFormSchema>({
    resolver: zodResolver(ZUpdateOrganisationBillingFormSchema),
    defaultValues: {
      customerId: organisation.customerId || '',
      claims: {
        teamCount: organisation.organisationClaim.teamCount,
        memberCount: organisation.organisationClaim.memberCount,
        envelopeItemCount: organisation.organisationClaim.envelopeItemCount,
        recipientCount: organisation.organisationClaim.recipientCount,
        envelopeContentCount: organisation.organisationClaim.envelopeContentCount,
        envelopeContentImageCount: organisation.organisationClaim.envelopeContentImageCount,
        flags: organisation.organisationClaim.flags,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        documentRateLimits: organisation.organisationClaim.documentRateLimits as NonNullable<
          TUpdateOrganisationBillingFormSchema['claims']
        >['documentRateLimits'],
        documentQuota: organisation.organisationClaim.documentQuota,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        emailRateLimits: organisation.organisationClaim.emailRateLimits as NonNullable<
          TUpdateOrganisationBillingFormSchema['claims']
        >['emailRateLimits'],
        emailQuota: organisation.organisationClaim.emailQuota,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        apiRateLimits: organisation.organisationClaim.apiRateLimits as NonNullable<
          TUpdateOrganisationBillingFormSchema['claims']
        >['apiRateLimits'],
        apiQuota: organisation.organisationClaim.apiQuota,
        emailTransportId: organisation.organisationClaim.emailTransportId ?? null,
      },
      originalSubscriptionClaimId: organisation.organisationClaim.originalSubscriptionClaimId || '',
      notifyOrganisation: true,
    },
  });

  const onSubmit = async ({ notifyOrganisation, ...values }: TUpdateOrganisationBillingFormSchema) => {
    try {
      const { isNotificationSent } = await updateOrganisation({
        organisationId: organisation.id,
        data: values,
        notifyOrganisation,
      });

      form.setValue('notifyOrganisation', false);

      const description = match({ notifyOrganisation, isNotificationSent })
        .with({ isNotificationSent: true }, () => t`Organisation has been updated and its owner has been notified`)
        .with(
          { notifyOrganisation: true },
          () => t`Organisation has been updated. No limits changed, so no notification was sent`,
        )
        .otherwise(() => t`Organisation has been updated successfully`);

      toast({
        title: t`Success`,
        description,
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
                  <TooltipTrigger type="button">
                    <InfoIcon className="mx-2 h-4 w-4" />
                  </TooltipTrigger>

                  <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
                    <h2>
                      <strong>
                        <Trans>Inherited subscription claim</Trans>
                      </strong>
                    </h2>

                    <p>
                      <Trans>
                        This is the claim that this organisation was initially created with. Any feature flag changes to
                        this claim will be backported into this organisation.
                      </Trans>
                    </p>

                    <p>
                      <Trans>
                        For example, if the claim has a new flag "FLAG_1" set to true, then this organisation will get
                        that flag added.
                      </Trans>
                    </p>
                    <p>
                      <Trans>
                        This will ONLY backport feature flags which are set to true, anything disabled in the initial
                        claim will not be backported
                      </Trans>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </FormLabel>
              <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
                {field.value ? (
                  <span className="font-mono text-foreground">{field.value}</span>
                ) : (
                  <span className="text-muted-foreground">
                    <Trans>No inherited claim</Trans>
                  </span>
                )}
              </div>
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
                  className="font-normal text-foreground/50 text-xs"
                >
                  {`https://dashboard.stripe.com/customers/${field.value}`}
                </Link>
              )}

              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <FormField
            control={form.control}
            name="claims.recipientCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Recipient Count</Trans>
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
                  <Trans>Maximum number of recipients per document allowed. 0 = Unlimited</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="claims.envelopeContentCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Envelope Content Count</Trans>
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
                  <Trans>Maximum number of contents per envelope allowed. 0 = Unlimited</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="claims.envelopeContentImageCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Envelope Content Image Count</Trans>
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
                  <Trans>Maximum number of image contents per envelope allowed. 0 = Unlimited</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <h3 className="font-semibold text-base">
            <Trans>Feature Flags</Trans>
          </h3>
          <p className="mt-1 text-muted-foreground text-sm">
            <Trans>Capabilities enabled for this organisation.</Trans>
          </p>

          <div className="mt-3 space-y-2 rounded-md border p-4">
            {Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).map(({ key, label, isEnterprise }) => {
              const isRestrictedFeature = isEnterprise && !licenseFlags?.[key as keyof TLicenseClaim]; // eslint-disable-line @typescript-eslint/consistent-type-assertions

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
                            disabled={isRestrictedFeature && !field.value} // Allow disabling of restricted features.
                          />

                          <label
                            className="ml-2 flex flex-row items-center text-muted-foreground text-sm"
                            htmlFor={`flag-${key}`}
                          >
                            {label}
                            {isRestrictedFeature && ' ¹'}
                          </label>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              );
            })}
          </div>

          {hasRestrictedEnterpriseFeatures && (
            <Alert variant="neutral" className="mt-4">
              <AlertDescription>
                <span>¹&nbsp;</span>
                <Trans>Your current license does not include these features.</Trans>{' '}
                <Link
                  to="https://docs.documenso.com/users/licenses/enterprise-edition"
                  target="_blank"
                  className="text-foreground underline hover:opacity-80"
                >
                  <Trans>Learn more</Trans>
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <ClaimLimitFields control={form.control} prefix="claims." />

        <FormField
          control={form.control}
          name="claims.emailTransportId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Email transport</Trans>
              </FormLabel>
              <Select
                value={field.value ?? NONE_VALUE}
                onValueChange={(value) => field.onChange(value === NONE_VALUE ? null : value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t`Default (system mailer)`} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{t`Default (system mailer)`}</SelectItem>
                  {transports.map((transport) => (
                    <SelectItem key={transport.id} value={transport.id}>
                      {transport.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                <Trans>Organisations without a transport use the system default mailer.</Trans>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notifyOrganisation"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center">
                <FormControl>
                  <Checkbox id="notify-organisation" checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>

                <label className="ml-2 text-muted-foreground text-sm" htmlFor="notify-organisation">
                  <Trans>Notify the organisation about limit changes</Trans>
                </label>
              </div>
              <FormDescription>
                <Trans>
                  Emails the organisation owner to let them know their limits have been updated. No email is sent if no
                  limits changed.
                </Trans>
              </FormDescription>
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
