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
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import type { z } from 'zod';

import { hasTwoFactorCode, TwoFactorCodeDialog, ZTwoFactorCodeFieldSchema } from './2fa/two-factor-code-dialog';

export const ZPasswordFormSchema = ZTwoFactorCodeFieldSchema.extend({
  currentPassword: ZCurrentPasswordSchema,
  password: ZPasswordSchema,
  repeatedPassword: ZPasswordSchema,
}).refine((data) => data.password === data.repeatedPassword, {
  message: 'Passwords do not match',
  path: ['repeatedPassword'],
});

export type TPasswordFormSchema = z.infer<typeof ZPasswordFormSchema>;

export type PasswordFormProps = {
  className?: string;
  user: SessionUser;
};

export const PasswordForm = ({ className, user }: PasswordFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isTwoFactorDialogOpen, setIsTwoFactorDialogOpen] = useState(false);

  const form = useForm<TPasswordFormSchema>({
    values: {
      currentPassword: '',
      password: '',
      repeatedPassword: '',
      totpCode: '',
      backupCode: '',
    },
    resolver: zodResolver(ZPasswordFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async (values: TPasswordFormSchema) => {
    const { currentPassword, password, totpCode, backupCode } = values;

    // Collect the 2FA code in a dialog once the password fields are valid.
    if (user.twoFactorEnabled && !hasTwoFactorCode(values)) {
      if (isTwoFactorDialogOpen) {
        const message = _(msg`A code is required`);

        form.setError('totpCode', { message });
        form.setError('backupCode', { message });
      }

      setIsTwoFactorDialogOpen(true);
      return;
    }

    try {
      await authClient.emailPassword.updatePassword({
        currentPassword,
        password,
        totpCode: totpCode || undefined,
        backupCode: backupCode || undefined,
      });

      form.reset();
      setIsTwoFactorDialogOpen(false);

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
        </fieldset>

        <div className="mt-4 ml-auto">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? <Trans>Updating password...</Trans> : <Trans>Update password</Trans>}
          </Button>
        </div>
      </form>

      <TwoFactorCodeDialog<TPasswordFormSchema>
        open={isTwoFactorDialogOpen}
        onOpenChange={setIsTwoFactorDialogOpen}
        isSubmitting={isSubmitting}
        submitLabel={<Trans>Update password</Trans>}
        onSubmit={form.handleSubmit(onFormSubmit)}
      />
    </Form>
  );
};
