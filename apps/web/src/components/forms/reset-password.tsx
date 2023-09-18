'use client';

import { useEffect } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ERROR_MESSAGES = {
  [ErrorCode.CREDENTIALS_NOT_FOUND]: 'No account found with that email address.',
  [ErrorCode.INCORRECT_EMAIL_PASSWORD]: 'No account found with that email address.',
  [ErrorCode.USER_MISSING_PASSWORD]:
    'This account appears to be using a social login method, please sign in using that method',
};

export const ZResetPasswordFormSchema = z
  .object({
    password: z.string().min(6).max(72),
    repeatedPassword: z.string().min(6).max(72),
  })
  .refine((data) => data.password === data.repeatedPassword, {
    path: ['repeatedPassword'],
    message: "Password don't match",
  });

export type TResetPasswordFormSchema = z.infer<typeof ZResetPasswordFormSchema>;

export type ResetPasswordFormProps = {
  className?: string;
};

export const ResetPasswordForm = ({ className }: ResetPasswordFormProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TResetPasswordFormSchema>({
    values: {
      password: '',
      repeatedPassword: '',
    },
    resolver: zodResolver(ZResetPasswordFormSchema),
  });

  const errorCode = searchParams?.get('error');

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;

    if (isErrorCode(errorCode)) {
      timeout = setTimeout(() => {
        toast({
          variant: 'destructive',
          description: ERROR_MESSAGES[errorCode] ?? 'An unknown error occurred',
        });
      }, 0);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [errorCode, toast]);

  const onFormSubmit = ({ password, repeatedPassword }: TResetPasswordFormSchema) => {
    console.log(password, repeatedPassword);

    router.push('/signin');
  };

  return (
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="password" className="flex justify-between text-slate-500">
          <span>Password</span>
        </Label>

        <Input
          id="password"
          type="password"
          minLength={6}
          maxLength={72}
          autoComplete="current-password"
          className="bg-background mt-2"
          {...register('password')}
        />

        {errors.password && (
          <span className="mt-1 text-xs text-red-500">{errors.password.message}</span>
        )}
      </div>

      <div>
        <Label htmlFor="repeatedPassword" className="flex justify-between text-slate-500">
          <span>Confirm Password</span>
        </Label>

        <Input
          id="repeatedPassword"
          type="password"
          minLength={6}
          maxLength={72}
          autoComplete="current-password"
          className="bg-background mt-2"
          {...register('repeatedPassword')}
        />

        {errors.repeatedPassword && (
          <span className="mt-1 text-xs text-red-500">{errors.repeatedPassword.message}</span>
        )}
      </div>

      <Button size="lg" disabled={isSubmitting} className="dark:bg-documenso dark:hover:opacity-90">
        {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
        Reset Password
      </Button>
    </form>
  );
};
