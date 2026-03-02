import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { SubscriptionClaim } from '@documenso/prisma/client';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';

import type { TLicenseClaim } from '@documenso/lib/types/license';
import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '@documenso/lib/types/subscription';
import { ZCreateSubscriptionClaimRequestSchema } from '@documenso/trpc/server/admin-router/create-subscription-claim.types';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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

export type SubscriptionClaimFormValues = z.infer<typeof ZCreateSubscriptionClaimRequestSchema>;

type SubscriptionClaimFormProps = {
  subscriptionClaim: Omit<SubscriptionClaim, 'id' | 'createdAt' | 'updatedAt'>;
  onFormSubmit: (data: SubscriptionClaimFormValues) => Promise<void>;
  formSubmitTrigger?: React.ReactNode;
  licenseFlags?: TLicenseClaim;
};

export const SubscriptionClaimForm = ({
  subscriptionClaim,
  onFormSubmit,
  formSubmitTrigger,
  licenseFlags,
}: SubscriptionClaimFormProps) => {
  const { t } = useLingui();

  const hasRestrictedEnterpriseFeatures = Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).some(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (flag) => flag.isEnterprise && !licenseFlags?.[flag.key as keyof TLicenseClaim],
  );

  const form = useForm<SubscriptionClaimFormValues>({
    resolver: zodResolver(ZCreateSubscriptionClaimRequestSchema),
    defaultValues: {
      name: subscriptionClaim.name,
      teamCount: subscriptionClaim.teamCount,
      memberCount: subscriptionClaim.memberCount,
      envelopeItemCount: subscriptionClaim.envelopeItemCount,
      flags: subscriptionClaim.flags,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Name</Trans>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t`Enter claim name`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="teamCount"
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
            name="memberCount"
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
            name="envelopeItemCount"
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
              {Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).map(
                ({ key, label, isEnterprise }) => {
                  const isRestrictedFeature =
                    isEnterprise && !licenseFlags?.[key as keyof TLicenseClaim]; // eslint-disable-line @typescript-eslint/consistent-type-assertions

                  return (
                    <FormField
                      key={key}
                      control={form.control}
                      name={`flags.${key}`}
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
                                className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
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
                },
              )}
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

          {formSubmitTrigger}
        </fieldset>
      </form>
    </Form>
  );
};
