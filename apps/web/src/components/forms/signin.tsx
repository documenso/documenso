'use client';

import { useState } from 'react';

import { useParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { FcGoogle } from 'react-icons/fc';
import { z } from 'zod';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input, PasswordInput } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { TwoFactorLoginDialog } from './2fa/two-factor-login-dialog';

const ERROR_MESSAGES: Partial<Record<keyof typeof ErrorCode, string>> = {
  [ErrorCode.CREDENTIALS_NOT_FOUND]: 'The email or password provided is incorrect',
  [ErrorCode.INCORRECT_EMAIL_PASSWORD]: 'The email or password provided is incorrect',
  [ErrorCode.USER_MISSING_PASSWORD]:
    'This account appears to be using a social login method, please sign in using that method',
};
const TwoFactorEnabledErrorCode = ErrorCode.TWO_FACTOR_MISSING_CREDENTIALS;

const LOGIN_REDIRECT_PATH = '/documents';

export const ZSignInFormSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(6, { message: 'Invalid password' }).max(72),
});

export type TSignInFormSchema = z.infer<typeof ZSignInFormSchema>;

export type SignInFormProps = {
  className?: string;
};

export const SignInForm = ({ className }: SignInFormProps) => {
  const { toast } = useToast();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [credentials, setCredentials] = useState<TSignInFormSchema | null>(null);
  const locale = useParams()?.locale as LocaleTypes;
  const { t } = useTranslation(locale, 'dashboard');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TSignInFormSchema>({
    values: {
      email: '',
      password: '',
    },
    resolver: zodResolver(ZSignInFormSchema),
  });

  const onFormSubmit = async ({ email, password }: TSignInFormSchema) => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl: LOGIN_REDIRECT_PATH,
        redirect: false,
      });

      if (result?.error && isErrorCode(result.error)) {
        if (result.error === TwoFactorEnabledErrorCode) {
          setCredentials({ email, password });
          setTotpEnabled(true);
        }

        const serverError = ERROR_MESSAGES?.[result.error];
        if (serverError) {
          toast({
            variant: 'destructive',
            description: serverError,
          });
        }

        return;
      }

      if (!result?.url) {
        throw new Error(t(`unknown-error`));
      }

      window.location.href = result.url;
    } catch (err) {
      toast({
        title: t(`unknown-error`),
        description: t(`we-encountered-an-unknown-error`),
      });
    }
  };

  const onSignInWithGoogleClick = async () => {
    try {
      await signIn('google', { callbackUrl: LOGIN_REDIRECT_PATH });
    } catch (err) {
      toast({
        title: t(`unknown-error`),
        description: t(`we-encountered-an-unknown-error`),
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={handleSubmit(onFormSubmit)}
      >
        <div>
          <Label htmlFor="email" className="text-muted-forground">
            Email
          </Label>

          <Input id="email" type="email" className="bg-background mt-2" {...register('email')} />

          <FormErrorMessage className="mt-1.5" error={errors.email} />
        </div>

        <div>
          <Label htmlFor="password" className="text-muted-forground">
            <span>Password</span>
          </Label>

          <PasswordInput
            id="password"
            minLength={6}
            maxLength={72}
            autoComplete="current-password"
            className="mt-2"
            {...register('password')}
          />

          <FormErrorMessage className="mt-1.5" error={errors.password} />
        </div>
        <Button
          size="lg"
          loading={isSubmitting}
          disabled={isSubmitting}
          className="dark:bg-documenso dark:hover:opacity-90"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>

        <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground bg-transparent">Or continue with</span>
          <div className="bg-border h-px flex-1" />
        </div>
        <Button
          type="button"
          size="lg"
          variant={'outline'}
          className="bg-background text-muted-foreground border"
          disabled={isSubmitting}
          onClick={onSignInWithGoogleClick}
        >
          <FcGoogle className="mr-2 h-5 w-5" />
          Google
        </Button>
      </form>
      <TwoFactorLoginDialog
        locale={locale}
        open={totpEnabled}
        onOpenChange={(val) => {
          setTotpEnabled(val);
        }}
        credentials={credentials}
      />
    </>
  );
};
