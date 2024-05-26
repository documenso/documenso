'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { KeyRoundIcon } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { FcGoogle } from 'react-icons/fc';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { trpc } from '@documenso/trpc/react';
import { ZCurrentPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
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

const ERROR_MESSAGES: Partial<Record<keyof typeof ErrorCode, string>> = {
  [ErrorCode.CREDENTIALS_NOT_FOUND]: 'მითითებული ელ.ფოსტა ან პაროლი არასწორია',
  [ErrorCode.INCORRECT_EMAIL_PASSWORD]: 'მითითებული ელ.ფოსტა ან პაროლი არასწორია',
  [ErrorCode.USER_MISSING_PASSWORD]:
    'როგორც ჩანს, ეს ანგარიში იყენებს სოციალური შესვლის მეთოდს, გთხოვთ შეხვიდეთ ამ მეთოდის გამოყენებით',
  [ErrorCode.INCORRECT_TWO_FACTOR_CODE]: 'მითითებული ორფაქტორიანი ავთენტიფიკაციის კოდი არასწორია',
  [ErrorCode.INCORRECT_TWO_FACTOR_BACKUP_CODE]: 'მითითებული სარეზერვო კოდი არასწორია',
  [ErrorCode.UNVERIFIED_EMAIL]:
    'ეს ანგარიში არ არის ვერიფიცირებული. გთხოვთ შესვლამდე ვერიფიკაცია გაიაროთ.',
};

const TwoFactorEnabledErrorCode = ErrorCode.TWO_FACTOR_MISSING_CREDENTIALS;

const LOGIN_REDIRECT_PATH = '/documents';

export const ZSignInFormSchema = z.object({
  email: z.string().email().min(1),
  password: ZCurrentPasswordSchema,
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TSignInFormSchema = z.infer<typeof ZSignInFormSchema>;

export type SignInFormProps = {
  className?: string;
  initialEmail?: string;
  isGoogleSSOEnabled?: boolean;
};

export const SignInForm = ({ className, initialEmail, isGoogleSSOEnabled }: SignInFormProps) => {
  const { toast } = useToast();
  const { getFlag } = useFeatureFlags();

  const router = useRouter();

  const [isTwoFactorAuthenticationDialogOpen, setIsTwoFactorAuthenticationDialogOpen] =
    useState(false);

  const [twoFactorAuthenticationMethod, setTwoFactorAuthenticationMethod] = useState<
    'totp' | 'backup'
  >('totp');

  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const isPasskeyEnabled = getFlag('app_passkey');

  const { mutateAsync: createPasskeySigninOptions } =
    trpc.auth.createPasskeySigninOptions.useMutation();

  const form = useForm<TSignInFormSchema>({
    values: {
      email: initialEmail ?? '',
      password: '',
      totpCode: '',
      backupCode: '',
    },
    resolver: zodResolver(ZSignInFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onCloseTwoFactorAuthenticationDialog = () => {
    form.setValue('totpCode', '');
    form.setValue('backupCode', '');

    setIsTwoFactorAuthenticationDialogOpen(false);
  };

  const onToggleTwoFactorAuthenticationMethodClick = () => {
    const method = twoFactorAuthenticationMethod === 'totp' ? 'backup' : 'totp';

    if (method === 'totp') {
      form.setValue('backupCode', '');
    }

    if (method === 'backup') {
      form.setValue('totpCode', '');
    }

    setTwoFactorAuthenticationMethod(method);
  };

  const onSignInWithPasskey = async () => {
    if (!browserSupportsWebAuthn()) {
      toast({
        title: '',
        // title: 'Not supported',
        description: 'საიდუმლო გასაღებები არ არის მხარდაჭერილი ამ ბრაუზერში',
        duration: 10000,
        variant: 'destructive',
      });

      return;
    }

    try {
      setIsPasskeyLoading(true);

      const options = await createPasskeySigninOptions();

      const credential = await startAuthentication(options);

      const result = await signIn('webauthn', {
        credential: JSON.stringify(credential),
        callbackUrl: LOGIN_REDIRECT_PATH,
        redirect: false,
      });

      if (!result?.url || result.error) {
        throw new AppError(result?.error ?? '');
      }

      window.location.href = result.url;
    } catch (err) {
      setIsPasskeyLoading(false);

      if (err.name === 'NotAllowedError') {
        return;
      }

      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with(
          AppErrorCode.NOT_SETUP,
          () =>
            'ეს საიდუმლო გასაღები არ არის კონფიგურირებული ამ აპლიკაციისთვის. გთხოვთ შეხვიდეთ სისტემაში და დაამატოთ ის მომხმარებლის პარამეტრებში.',
        )
        .with(AppErrorCode.EXPIRED_CODE, () => 'სესიას ვადა ამოეწურა. გთხოვთ თავიდან სცადეთ.')
        .otherwise(
          () =>
            'გთხოვთ სცადოთ მოგვიანებით ან შედით სისტემაში თქვენი ჩვეულებრივი მონაცემების გამოყენებით',
        );

      toast({
        title: 'დაფიქსირდა ხარვეზი',
        description: errorMessage,
        duration: 10000,
        variant: 'destructive',
      });
    }
  };

  const onFormSubmit = async ({ email, password, totpCode, backupCode }: TSignInFormSchema) => {
    try {
      const credentials: Record<string, string> = {
        email,
        password,
      };

      if (totpCode) {
        credentials.totpCode = totpCode;
      }

      if (backupCode) {
        credentials.backupCode = backupCode;
      }

      const result = await signIn('credentials', {
        ...credentials,
        callbackUrl: LOGIN_REDIRECT_PATH,
        redirect: false,
      });

      if (result?.error && isErrorCode(result.error)) {
        if (result.error === TwoFactorEnabledErrorCode) {
          setIsTwoFactorAuthenticationDialogOpen(true);
          return;
        }

        const errorMessage = ERROR_MESSAGES[result.error];

        if (result.error === ErrorCode.UNVERIFIED_EMAIL) {
          router.push(`/unverified-account`);

          toast({
            title: 'ავტორიზაცია ვერ მოხერხდა',
            description: errorMessage ?? 'დაფიქსირდა ხარვეზი',
          });

          return;
        }

        toast({
          variant: 'destructive',
          title: 'ავტორიზაცია ვერ მოხერხდა',
          description: errorMessage ?? 'დაფიქსირდა ხარვეზი',
        });

        return;
      }

      if (!result?.url) {
        throw new Error('დაფიქსირდა ხარვეზი');
      }

      window.location.href = result.url;
    } catch (err) {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        description:
          'თქვენი ავტორიზაციისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
      });
    }
  };

  const onSignInWithGoogleClick = async () => {
    try {
      await signIn('google', { callbackUrl: LOGIN_REDIRECT_PATH });
    } catch (err) {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        description:
          'თქვენი ავტორიზაციისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset
          className="flex w-full flex-col gap-y-4"
          disabled={isSubmitting || isPasskeyLoading}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ელ.ფოსტა</FormLabel>

                <FormControl>
                  <Input type="email" {...field} />
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
                <FormLabel>პაროლი</FormLabel>

                <FormControl>
                  <PasswordInput {...field} />
                </FormControl>

                <FormMessage />

                <p className="mt-2 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-muted-foreground text-sm duration-200 hover:opacity-70"
                  >
                    დაგავიწყდათ პაროლი?
                  </Link>
                </p>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            className="dark:bg-documenso dark:hover:opacity-90"
          >
            {isSubmitting ? 'ავტორიზაცია...' : 'ავტორიზაცია'}
          </Button>

          {(isGoogleSSOEnabled || isPasskeyEnabled) && (
            <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground bg-transparent">ან განაგრძეთ</span>
              <div className="bg-border h-px flex-1" />
            </div>
          )}

          {isGoogleSSOEnabled && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="bg-background text-muted-foreground border"
              disabled={isSubmitting}
              onClick={onSignInWithGoogleClick}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              Google
            </Button>
          )}

          {isPasskeyEnabled && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={isSubmitting}
              loading={isPasskeyLoading}
              className="bg-background text-muted-foreground border"
              onClick={onSignInWithPasskey}
            >
              {!isPasskeyLoading && <KeyRoundIcon className="-ml-1 mr-1 h-5 w-5" />}
              Passkey
            </Button>
          )}
        </fieldset>
      </form>

      <Dialog
        open={isTwoFactorAuthenticationDialogOpen}
        onOpenChange={onCloseTwoFactorAuthenticationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ორფაქტორიანი ავთენტიფიკაცია</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset disabled={isSubmitting}>
              {twoFactorAuthenticationMethod === 'totp' && (
                <FormField
                  control={form.control}
                  name="totpCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ავთენტიფიკაციის ტოკენი</FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {twoFactorAuthenticationMethod === 'backup' && (
                <FormField
                  control={form.control}
                  name="backupCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel> სარეზერვო კოდი</FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onToggleTwoFactorAuthenticationMethodClick}
                >
                  {twoFactorAuthenticationMethod === 'totp'
                    ? 'გამოიყენეთ სარეზერვო კოდი'
                    : 'გამოიყენეთ ავთენტიპიკატორი'}
                </Button>

                <Button type="submit" loading={isSubmitting}>
                  {isSubmitting ? 'მიმდინარეობს ავტორიზაცია...' : 'ავტორიზაცია'}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </Form>
  );
};
