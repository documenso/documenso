import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { authClient } from '@documenso/auth/client';
import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { AppError } from '@documenso/lib/errors/app-error';
import { ZPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
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
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { signupErrorMessages } from '~/components/forms/signup';

export type ClaimAccountProps = {
  defaultName: string;
  defaultEmail: string;
  trigger?: React.ReactNode;
};

export const ZClaimAccountFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: msg`Please enter a valid name.`.id }),
    email: z.string().email().min(1),
    password: ZPasswordSchema,
  })
  .refine(
    (data) => {
      const { name, email, password } = data;
      return !password.includes(name) && !password.includes(email.split('@')[0]);
    },
    {
      message: msg`Password should not be common or based on personal information`.id,
      path: ['password'],
    },
  );

export type TClaimAccountFormSchema = z.infer<typeof ZClaimAccountFormSchema>;

export const ClaimAccount = ({ defaultName, defaultEmail }: ClaimAccountProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const analytics = useAnalytics();
  const navigate = useNavigate();

  const form = useForm<TClaimAccountFormSchema>({
    values: {
      name: defaultName ?? '',
      email: defaultEmail,
      password: '',
    },
    resolver: zodResolver(ZClaimAccountFormSchema),
  });

  const onFormSubmit = async ({ name, email, password }: TClaimAccountFormSchema) => {
    try {
      await authClient.emailPassword.signUp({ name, email, password });

      await navigate(`/unverified-account`);

      toast({
        title: _(msg`Registration Successful`),
        description: _(
          msg`You have successfully registered. Please verify your account by clicking on the link you received in the email.`,
        ),
        duration: 5000,
      });

      analytics.capture('App: User Claim Account', {
        email,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = signupErrorMessages[error.code] ?? signupErrorMessages.INVALID_REQUEST;

      toast({
        title: _(msg`An error occurred`),
        description: _(errorMessage),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mt-2 w-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)}>
          <fieldset disabled={form.formState.isSubmitting} className="mt-4">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Name</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={_(msg`Enter your name`)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>
                    <Trans>Email address</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={_(msg`Enter your email`)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="password"
              control={form.control}
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>
                    <Trans>Set a password</Trans>
                  </FormLabel>
                  <FormControl>
                    <PasswordInput {...field} placeholder={_(msg`Pick a password`)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="mt-6 w-full" loading={form.formState.isSubmitting}>
              <Trans>Claim account</Trans>
            </Button>
          </fieldset>
        </form>
      </Form>
    </div>
  );
};
