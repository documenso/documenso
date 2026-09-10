import { authClient } from '@documenso/auth/client';
import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { ZCurrentPasswordSchema, ZPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import type { z } from 'zod';

import { hasTwoFactorCode, TwoFactorCodeField, ZTwoFactorCodeFieldSchema } from './2fa/two-factor-code-field';

const createPasswordFormSchema = (isTwoFactorRequired: boolean) =>
  ZTwoFactorCodeFieldSchema.extend({
    currentPassword: ZCurrentPasswordSchema,
    password: ZPasswordSchema,
    repeatedPassword: ZPasswordSchema,
  })
    .refine((data) => data.password === data.repeatedPassword, {
      message: 'Passwords do not match',
      path: ['repeatedPassword'],
    })
    .refine((data) => !isTwoFactorRequired || hasTwoFactorCode(data), {
      message: 'A two factor code is required',
      path: ['totpCode'],
    });

export type TPasswordFormSchema = z.infer<ReturnType<typeof createPasswordFormSchema>>;

export type PasswordFormProps = {
  className?: string;
  user: SessionUser;
};

export const PasswordForm = ({ className, user }: PasswordFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const isTwoFactorRequired = user.twoFactorEnabled;

  const schema = useMemo(() => createPasswordFormSchema(isTwoFactorRequired), [isTwoFactorRequired]);

  const form = useForm<TPasswordFormSchema>({
    values: {
      currentPassword: '',
      password: '',
      repeatedPassword: '',
      totpCode: '',
      backupCode: '',
    },
    resolver: zodResolver(schema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async ({ currentPassword, password, totpCode, backupCode }: TPasswordFormSchema) => {
    try {
      await authClient.emailPassword.updatePassword({
        currentPassword,
        password,
        totpCode: totpCode || undefined,
        backupCode: backupCode || undefined,
      });

      form.reset();

      toast({
        title: _(msg`Password updated`),
        description: _(msg`Your password has been updated successfully.`),
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with(AppErrorCode.NO_PASSWORD, () => msg`User has no password.`)
        .with(AppErrorCode.INCORRECT_PASSWORD, () => msg`Current password is incorrect.`)
        .with(AppErrorCode.SAME_PASSWORD, () => msg`Your new password cannot be the same as your old password.`)
        .with(
          AppErrorCode.INCORRECT_TWO_FACTOR_CODE,
          AppErrorCode.TWO_FACTOR_MISSING_CREDENTIALS,
          () => msg`The two factor code you provided is invalid. Please try again.`,
        )
        .otherwise(
          () => msg`We encountered an unknown error while attempting to update your password. Please try again later.`,
        );

      toast({
        title: _(msg`An error occurred`),
        description: _(errorMessage),
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      {/* method="post" so a pre-hydration native submit can't leak passwords into the URL. */}
      <form
        method="post"
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Current Password</Trans>
                </FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>New Password</Trans>
                </FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="repeatedPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Repeat Password</Trans>
                </FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isTwoFactorRequired && <TwoFactorCodeField<TPasswordFormSchema> />}
        </fieldset>

        <div className="mt-4 ml-auto">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? <Trans>Updating password...</Trans> : <Trans>Update password</Trans>}
          </Button>
        </div>
      </form>
    </Form>
  );
};
