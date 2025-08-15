import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { OrganisationMemberRole } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { ORGANISATION_MEMBER_ROLE_HIERARCHY } from '@documenso/lib/constants/organisations';
import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import {
  formatOrganisationCallbackUrl,
  formatOrganisationLoginUrl,
} from '@documenso/lib/utils/organisation-authentication-portal';
import { trpc } from '@documenso/trpc/react';
import { domainRegex } from '@documenso/trpc/server/enterprise-router/create-organisation-email-domain.types';
import type { TGetOrganisationAuthenticationPortalResponse } from '@documenso/trpc/server/enterprise-router/get-organisation-authentication-portal.types';
import { ZUpdateOrganisationAuthenticationPortalRequestSchema } from '@documenso/trpc/server/enterprise-router/update-organisation-authentication-portal.types';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

const ZProviderFormSchema = ZUpdateOrganisationAuthenticationPortalRequestSchema.shape.data
  .pick({
    enabled: true,
    wellKnownUrl: true,
    clientId: true,
    autoProvisionUsers: true,
    defaultOrganisationRole: true,
  })
  .extend({
    clientSecret: z.string().nullable(),
    allowedDomains: z.string().refine(
      (value) => {
        const domains = value.split(' ').filter(Boolean);

        return domains.every((domain) => domainRegex.test(domain));
      },
      {
        message: msg`Invalid domains`.id,
      },
    ),
  });

type TProviderFormSchema = z.infer<typeof ZProviderFormSchema>;

export function meta() {
  return appMetaTags('Organisation SSO Portal');
}

export default function OrganisationSettingSSOLoginPage() {
  const { t } = useLingui();
  const organisation = useCurrentOrganisation();

  const { data: authenticationPortal, isLoading: isLoadingAuthenticationPortal } =
    trpc.enterprise.organisation.authenticationPortal.get.useQuery({
      organisationId: organisation.id,
    });

  if (isLoadingAuthenticationPortal || !authenticationPortal) {
    return <SpinnerBox className="py-32" />;
  }

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={t`Organisation SSO Portal`}
        subtitle={t`Manage a custom SSO login portal for your organisation.`}
      />

      <SSOProviderForm authenticationPortal={authenticationPortal} />
    </div>
  );
}

type SSOProviderFormProps = {
  authenticationPortal: TGetOrganisationAuthenticationPortalResponse;
};

const SSOProviderForm = ({ authenticationPortal }: SSOProviderFormProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const { mutateAsync: updateOrganisationAuthenticationPortal } =
    trpc.enterprise.organisation.authenticationPortal.update.useMutation();

  const form = useForm<TProviderFormSchema>({
    resolver: zodResolver(ZProviderFormSchema),
    defaultValues: {
      enabled: authenticationPortal.enabled,
      clientId: authenticationPortal.clientId,
      clientSecret: authenticationPortal.clientSecretProvided ? null : '',
      wellKnownUrl: authenticationPortal.wellKnownUrl,
      autoProvisionUsers: authenticationPortal.autoProvisionUsers,
      defaultOrganisationRole: authenticationPortal.defaultOrganisationRole,
      allowedDomains: authenticationPortal.allowedDomains.join(' '),
    },
  });

  const onSubmit = async (values: TProviderFormSchema) => {
    const { enabled, clientId, clientSecret, wellKnownUrl } = values;

    if (enabled && !clientId) {
      form.setError('clientId', {
        message: t`Client ID is required`,
      });

      return;
    }

    if (enabled && clientSecret === '') {
      form.setError('clientSecret', {
        message: t`Client secret is required`,
      });

      return;
    }

    if (enabled && !wellKnownUrl) {
      form.setError('wellKnownUrl', {
        message: t`Well-known URL is required`,
      });

      return;
    }

    try {
      await updateOrganisationAuthenticationPortal({
        organisationId: organisation.id,
        data: {
          enabled,
          clientId,
          clientSecret: values.clientSecret ?? undefined,
          wellKnownUrl,
          autoProvisionUsers: values.autoProvisionUsers,
          defaultOrganisationRole: values.defaultOrganisationRole,
          allowedDomains: values.allowedDomains.split(' ').filter(Boolean),
        },
      });

      toast({
        title: t`Success`,
        description: t`Provider has been updated successfully`,
        duration: 5000,
      });
    } catch (err) {
      console.error(err);

      toast({
        title: t`An error occurred`,
        description: t`We couldn't update the provider. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  const isSsoEnabled = form.watch('enabled');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset disabled={form.formState.isSubmitting} className="space-y-6">
          <div className="space-y-2">
            <Label>
              <Trans>Organisation authentication portal URL</Trans>
            </Label>

            <div className="relative">
              <Input
                className="pr-12"
                disabled
                value={formatOrganisationLoginUrl(organisation.url)}
              />
              <div className="absolute bottom-0 right-2 top-0 flex items-center justify-center">
                <CopyTextButton
                  value={formatOrganisationLoginUrl(organisation.url)}
                  onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
                />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              <Trans>This is the URL which users will use to sign in to your organisation.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              <Trans>Redirect URI</Trans>
            </Label>

            <div className="relative">
              <Input
                className="pr-12"
                disabled
                value={formatOrganisationCallbackUrl(organisation.url)}
              />
              <div className="absolute bottom-0 right-2 top-0 flex items-center justify-center">
                <CopyTextButton
                  value={formatOrganisationCallbackUrl(organisation.url)}
                  onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
                />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              <Trans>Add this URL to your provider's allowed redirect URIs</Trans>
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              <Trans>Required scopes</Trans>
            </Label>

            <Input className="pr-12" disabled value={`openid profile email`} />

            <p className="text-muted-foreground text-xs">
              <Trans>This is the required scopes you must set in your provider's settings</Trans>
            </p>
          </div>

          <FormField
            control={form.control}
            name="wellKnownUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel required={isSsoEnabled}>
                  <Trans>Issuer URL</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={'https://your-provider.com/.well-known/openid-configuration'}
                    {...field}
                  />
                </FormControl>

                {!form.formState.errors.wellKnownUrl && (
                  <p className="text-muted-foreground text-xs">
                    <Trans>The OpenID discovery endpoint URL for your provider</Trans>
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required={isSsoEnabled}>
                    <Trans>Client ID</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input id="client-id" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required={isSsoEnabled}>
                    <Trans>Client Secret</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="client-secret"
                      type="password"
                      {...field}
                      value={field.value === null ? '**********************' : field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="defaultOrganisationRole"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Default Organisation Role for New Users</Trans>
                </FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t`Select default role`} />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANISATION_MEMBER_ROLE_HIERARCHY[OrganisationMemberRole.MANAGER].map(
                        (role) => (
                          <SelectItem key={role} value={role}>
                            {t(ORGANISATION_MEMBER_ROLE_MAP[role])}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="allowedDomains"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Allowed Email Domains</Trans>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder={t`your-domain.com another-domain.com`}
                    className="min-h-[80px]"
                  />
                </FormControl>

                {!form.formState.errors.allowedDomains && (
                  <p className="text-muted-foreground text-xs">
                    <Trans>
                      Space-separated list of domains. Leave empty to allow all domains.
                    </Trans>
                  </p>
                )}

                <FormMessage />
              </FormItem>
            )}
          />

          {/* Todo: This is just dummy toggle, we need to decide what this does first. */}
          {/* <FormField
            control={form.control}
            name="autoProvisionUsers"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="space-y-0.5">
                  <FormLabel>
                    <Trans>Auto-provision Users</Trans>
                  </FormLabel>
                  <p className="text-muted-foreground text-sm">
                    <Trans>Automatically create accounts for new users on first login</Trans>
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}

          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="space-y-0.5">
                  <FormLabel>
                    <Trans>Enable SSO portal</Trans>
                  </FormLabel>
                  <p className="text-muted-foreground text-sm">
                    <Trans>Whether to enable the SSO portal for your organisation</Trans>
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Alert variant="warning">
            <AlertDescription>
              <Trans>
                Please note that anyone who signs in through your portal will be added to your
                organisation as a member.
              </Trans>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button loading={form.formState.isSubmitting} type="submit">
              <Trans>Update</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
