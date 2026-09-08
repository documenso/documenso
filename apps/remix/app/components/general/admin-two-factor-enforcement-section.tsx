import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isTwoFactorGracePeriodReduction } from '@documenso/lib/utils/two-factor';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
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
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { LoaderIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ZTwoFactorEnforcementFormSchema = z.object({
  enabled: z.boolean(),
  gracePeriodDays: z.coerce.number().int().min(0).max(365),
  acknowledgeGracePeriodReduction: z.boolean(),
});

type TTwoFactorEnforcementFormSchema = z.infer<typeof ZTwoFactorEnforcementFormSchema>;

/**
 * Instance-wide 2FA enforcement settings for the admin site-settings page.
 *
 * License-gated states:
 *
 * - Licensed: full form.
 * - Unlicensed + unconfigured: section visible but disabled with a "requires
 *   license" note.
 * - Unlicensed + configured ("configured but inactive", e.g. license lapsed):
 *   stored values shown read-only with a disable-only affordance — the only
 *   permitted unlicensed update is turning the stored policy off.
 */
export const AdminTwoFactorEnforcementSection = () => {
  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const { data: enforcementConfig, isLoading } = trpc.admin.getTwoFactorEnforcement.useQuery();

  const utils = trpc.useUtils();

  const { mutateAsync: updateTwoFactorEnforcement, isPending: isUpdatePending } =
    trpc.admin.updateTwoFactorEnforcement.useMutation();

  const form = useForm<TTwoFactorEnforcementFormSchema>({
    values: {
      enabled: enforcementConfig?.enabled ?? false,
      gracePeriodDays: enforcementConfig?.gracePeriodDays ?? 7,
      acknowledgeGracePeriodReduction: false,
    },
    resolver: zodResolver(ZTwoFactorEnforcementFormSchema),
  });

  const watchedValues = form.watch();

  const isLicensed = enforcementConfig?.isLicensed ?? false;
  const isConfiguredButInactive = !isLicensed && (enforcementConfig?.enabled ?? false);

  // Client-side mirror of the server's grace-reduction detection so we can
  // surface the acknowledgement checkbox before submitting. The server resets
  // `enforcedFrom` to now on an off→on transition, hence the `new Date()`
  // anchor when the stored policy is currently disabled.
  const isGraceReduction =
    enforcementConfig !== undefined &&
    isTwoFactorGracePeriodReduction({
      previous: enforcementConfig.enabled
        ? {
            anchors: [enforcementConfig.enforcedFrom ? new Date(enforcementConfig.enforcedFrom) : null],
            gracePeriodDays: enforcementConfig.gracePeriodDays,
          }
        : null,
      next: watchedValues.enabled
        ? {
            anchors: [
              enforcementConfig.enabled && enforcementConfig.enforcedFrom
                ? new Date(enforcementConfig.enforcedFrom)
                : new Date(),
            ],
            gracePeriodDays: watchedValues.gracePeriodDays,
          }
        : null,
      now: new Date(),
    });

  const onUpdate = async (data: {
    enabled: boolean;
    gracePeriodDays: number;
    acknowledgeGracePeriodReduction?: boolean;
  }) => {
    try {
      await updateTwoFactorEnforcement(data);

      await utils.admin.getTwoFactorEnforcement.invalidate();

      toast({
        title: _(msg`Two-factor enforcement settings updated`),
      });

      form.setValue('acknowledgeGracePeriodReduction', false);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.TWO_FACTOR_REQUIRED) {
        toast({
          title: _(msg`Two-factor authentication required`),
          description: _(
            msg`Enable two-factor authentication on your own account and verify it on this session before requiring it for the instance.`,
          ),
          variant: 'destructive',
        });

        return;
      }

      if (error.code === AppErrorCode.FORBIDDEN) {
        toast({
          title: _(msg`License required`),
          description: _(
            msg`Your license does not include instance-wide two-factor enforcement. Only disabling the stored configuration is permitted.`,
          ),
          variant: 'destructive',
        });

        return;
      }

      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`We were unable to update the two-factor enforcement settings. Please try again.`),
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: TTwoFactorEnforcementFormSchema) => {
    await onUpdate(data);
  };

  // Disable-only affordance for the "configured but inactive" state: submits
  // an enabled→disabled transition with the stored values unchanged, which is
  // the only unlicensed update the server accepts.
  const onDisableOnly = async () => {
    if (!enforcementConfig) {
      return;
    }

    await onUpdate({
      enabled: false,
      gracePeriodDays: enforcementConfig.gracePeriodDays,
    });
  };

  return (
    <div>
      <h2 className="font-semibold">
        <Trans>Instance Two-Factor Enforcement</Trans>
      </h2>
      <p className="mt-2 text-muted-foreground text-sm">
        <Trans>
          Require every user on this instance, including administrators, to enable two-factor authentication within a
          grace period.
        </Trans>
      </p>

      {isLoading || !enforcementConfig ? (
        <div className="mt-4 flex justify-center rounded-lg border py-16">
          <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset disabled={form.formState.isSubmitting || !isLicensed} className="mt-4 flex flex-col gap-y-4">
              {!isLicensed && !isConfiguredButInactive && (
                <Alert variant="neutral">
                  <AlertTitle>
                    <Trans>Requires a license</Trans>
                  </AlertTitle>
                  <AlertDescription>
                    <Trans>
                      Instance-wide two-factor enforcement requires a Documenso license that includes this feature.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}

              {isConfiguredButInactive && (
                <Alert variant="warning">
                  <AlertTitle>
                    <Trans>Configured but inactive</Trans>
                  </AlertTitle>
                  <AlertDescription>
                    <Trans>
                      Two-factor enforcement is configured but your current license does not include this feature, so it
                      is not being enforced. You can disable the stored configuration below; changing it requires a
                      license.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5 pr-4">
                      <FormLabel>
                        <Trans>Require two-factor authentication</Trans>
                      </FormLabel>
                      <FormDescription>
                        <Trans>
                          Users who have not enabled two-factor authentication by their deadline are redirected to a
                          forced enrolment page before they can continue.
                        </Trans>
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gracePeriodDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Grace period (days)</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={365} {...field} />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Number of days a user has to enable two-factor authentication. 0 forces enrolment immediately
                        after signing up or signing in.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {enforcementConfig.isActive && enforcementConfig.enforcedFrom && (
                <p className="text-muted-foreground text-sm">
                  <Trans>
                    Enforcement has been active since{' '}
                    {i18n.date(new Date(enforcementConfig.enforcedFrom), { dateStyle: 'long' })}.
                  </Trans>
                </p>
              )}

              <Alert variant="neutral">
                <AlertDescription>
                  <Trans>
                    API tokens are exempt: tokens minted before a user's deadline keep working after it. Blocked users
                    cannot mint new tokens.
                  </Trans>
                </AlertDescription>
              </Alert>

              {isGraceReduction && (
                <Alert variant="warning">
                  <AlertTitle>
                    <Trans>This change reduces an active grace period</Trans>
                  </AlertTitle>
                  <AlertDescription className="flex flex-col gap-y-3">
                    <Trans>
                      Users who have not yet enabled two-factor authentication will have less time to comply — possibly
                      none, which blocks their access immediately.
                    </Trans>

                    <FormField
                      control={form.control}
                      name="acknowledgeGracePeriodReduction"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(checked === true)}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            <Trans>I understand that this reduces the remaining grace period for users</Trans>
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={form.formState.isSubmitting}
                  disabled={isGraceReduction && !watchedValues.acknowledgeGracePeriodReduction}
                >
                  <Trans>Update</Trans>
                </Button>
              </div>
            </fieldset>

            {isConfiguredButInactive && (
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="destructive" loading={isUpdatePending} onClick={onDisableOnly}>
                  <Trans>Disable enforcement</Trans>
                </Button>
              </div>
            )}
          </form>
        </Form>
      )}
    </div>
  );
};
