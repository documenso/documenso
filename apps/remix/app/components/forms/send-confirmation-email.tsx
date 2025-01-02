import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { authClient } from '@documenso/auth/client';
import { cn } from '@documenso/ui/lib/utils';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZSendConfirmationEmailFormSchema = z.object({
  email: z.string().email().min(1),
});

export type TSendConfirmationEmailFormSchema = z.infer<typeof ZSendConfirmationEmailFormSchema>;

export type SendConfirmationEmailFormProps = {
  className?: string;
};

export const SendConfirmationEmailForm = ({ className }: SendConfirmationEmailFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const form = useForm<TSendConfirmationEmailFormSchema>({
    values: {
      email: '',
    },
    resolver: zodResolver(ZSendConfirmationEmailFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async ({ email }: TSendConfirmationEmailFormSchema) => {
    try {
      await authClient.emailPassword.resendVerifyEmail({ email });

      toast({
        title: _(msg`Confirmation email sent`),
        description: _(
          msg`A confirmation email has been sent, and it should arrive in your inbox shortly.`,
        ),
        duration: 5000,
      });

      form.reset();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: _(msg`An error occurred while sending your confirmation email`),
        description: _(msg`Please try again and make sure you enter the correct email address.`),
      });
    }
  };

  return (
    <Form {...form}>
      <form
        className={cn('mt-6 flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Email address</Trans>
                </FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormMessage />

          <Button size="lg" type="submit" disabled={isSubmitting} loading={isSubmitting}>
            <Trans>Send confirmation email</Trans>
          </Button>
        </fieldset>
      </form>
    </Form>
  );
};
