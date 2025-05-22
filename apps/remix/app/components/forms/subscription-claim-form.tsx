import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { SubscriptionClaim } from '@prisma/client';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '@documenso/lib/types/subscription';
import { ZCreateSubscriptionClaimRequestSchema } from '@documenso/trpc/server/admin-router/create-subscription-claim.types';
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
};

export const SubscriptionClaimForm = ({
  subscriptionClaim,
  onFormSubmit,
  formSubmitTrigger,
}: SubscriptionClaimFormProps) => {
  const { t } = useLingui();

  const form = useForm<SubscriptionClaimFormValues>({
    resolver: zodResolver(ZCreateSubscriptionClaimRequestSchema),
    defaultValues: {
      name: subscriptionClaim.name,
      teamCount: subscriptionClaim.teamCount,
      memberCount: subscriptionClaim.memberCount,
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

          <div>
            <FormLabel>
              <Trans>Feature Flags</Trans>
            </FormLabel>

            <div className="mt-2 space-y-2 rounded-md border p-4">
              {Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).map(({ key, label }) => (
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

          {formSubmitTrigger}
        </fieldset>
      </form>
    </Form>
  );
};
