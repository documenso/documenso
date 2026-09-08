import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
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
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ZTwoFactorEnforcementFormSchema = z.object({
  twoFactorRequired: z.boolean(),
  twoFactorGracePeriodDays: z.coerce.number().int().min(0).max(365),
  acknowledgeGracePeriodReduction: z.boolean(),
});

type TTwoFactorEnforcementFormSchema = z.infer<typeof ZTwoFactorEnforcementFormSchema>;

/**
 * Organisation 2FA enforcement settings (require toggle + grace period).
 *
 * Rendered only for MANAGE_ORGANISATION_SECURITY holders (ADMIN). When
 * instance-wide enforcement is active the fields are shown disabled — not
 * hidden — with a banner explaining that the instance policy takes
 * precedence, so a configured organisation policy stays visible instead of
 * resurfacing already-expired later.
 */
export const OrganisationTwoFactorEnforcementForm = () => {
  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();
  const { twoFactorEnforcement: instanceTwoFactorEnforcement } = useSession();

  const isInstanceEnforcementActive = instanceTwoFactorEnforcement.required;

  const { data: organisationWithSettings, isLoading } = trpc.organisation.get.useQuery({
    organisationReference: organisation.url,
  });

  const utils = trpc.useUtils();

  const { mutateAsync: updateOrganisationSettings } = trpc.organisation.settings.update.useMutation();

  const settings = organisationWithSettings?.organisationGlobalSettings;

  const form = useForm<TTwoFactorEnforcementFormSchema>({
    values: {
      twoFactorRequired: settings?.twoFactorRequired ?? false,
      twoFactorGracePeriodDays: settings?.twoFactorGracePeriodDays ?? 7,
      acknowledgeGracePeriodReduction: false,
    },
    resolver: zodResolver(ZTwoFactorEnforcementFormSchema),
  });

  const watchedValues = form.watch();

  // Client-side mirror of the server's grace-reduction detection so we can
  // surface the acknowledgement checkbox before submitting.
  const isGraceReduction =
    settings !== undefined &&
    isTwoFactorGracePeriodReduction({
      previous: settings.twoFactorRequired
        ? {
            anchors: [settings.twoFactorEnforcedFrom],
            gracePeriodDays: settings.twoFactorGracePeriodDays,
          }
        : null,
      next: watchedValues.twoFactorRequired
        ? {
            anchors: [settings.twoFactorRequired ? settings.twoFactorEnforcedFrom : new Date()],
            gracePeriodDays: watchedValues.twoFactorGracePeriodDays,
          }
        : null,
      now: new Date(),
    });

  const onSubmit = async (data: TTwoFactorEnforcementFormSchema) => {
    try {
      await updateOrganisationSettings({
        organisationId: organisation.id,
        acknowledgeGracePeriodReduction: data.acknowledgeGracePeriodReduction,
        data: {
          twoFactorRequired: data.twoFactorRequired,
          twoFactorGracePeriodDays: data.twoFactorGracePeriodDays,
        },
      });

      await utils.organisation.get.invalidate();

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
            msg`You must have two-factor authentication enabled and verified on this session before requiring it for the organisation.`,
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

  if (isLoading || !settings) {
    return (
      <div className="flex justify-center rounded-lg border py-16">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset
          disabled={form.formState.isSubmitting || isInstanceEnforcementActive}
          className="flex flex-col gap-y-4"
        >
          {isInstanceEnforcementActive && (
            <Alert variant="neutral">
              <AlertTitle>
                <Trans>Instance policy takes precedence</Trans>
              </AlertTitle>
              <AlertDescription>
                <Trans>
                  Two-factor authentication is enforced instance-wide by your administrator, so the organisation policy
                  below is not editable while the instance policy is active.
                </Trans>
              </AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="twoFactorRequired"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5 pr-4">
                  <FormLabel>
                    <Trans>Require two-factor authentication</Trans>
                  </FormLabel>
                  <FormDescription>
                    <Trans>
                      Members must enable two-factor authentication to access this organisation. Joining is never
                      blocked — the grace period starts when a member joins.
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
            name="twoFactorGracePeriodDays"
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
                    Number of days a member has to enable two-factor authentication after joining. 0 blocks organisation
                    access immediately until they enrol.
                  </Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {settings.twoFactorRequired && settings.twoFactorEnforcedFrom && (
            <p className="text-muted-foreground text-sm">
              <Trans>
                Enforcement has been active since {i18n.date(settings.twoFactorEnforcedFrom, { dateStyle: 'long' })}.
              </Trans>
            </p>
          )}

          <Alert variant="neutral">
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <Trans>
                    API tokens are exempt: tokens minted before a member's deadline keep working after it. Blocked
                    members cannot mint new tokens.
                  </Trans>
                </li>
                <li>
                  <Trans>
                    Members who have not yet complied still occupy a seat and count towards your member limit.
                  </Trans>
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          {isGraceReduction && (
            <Alert variant="warning">
              <AlertTitle>
                <Trans>This change reduces an active grace period</Trans>
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-y-3">
                <Trans>
                  Members who have not yet enabled two-factor authentication will have less time to comply — possibly
                  none, which blocks their organisation access immediately.
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
                        <Trans>I understand that this reduces the remaining grace period for members</Trans>
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
      </form>
    </Form>
  );
};
