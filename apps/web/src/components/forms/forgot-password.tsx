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

export const ZForgotPasswordFormSchema = z.object({
  email: z.string().email().min(1),
});

export type TForgotPasswordFormSchema = z.infer<typeof ZForgotPasswordFormSchema>;

export type ForgotPasswordFormProps = {
  className?: string;
};

export const ForgotPasswordForm = ({ className }: ForgotPasswordFormProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TForgotPasswordFormSchema>({
    values: {
      email: '',
    },
    resolver: zodResolver(ZForgotPasswordFormSchema),
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

  const onFormSubmit = ({ email }: TForgotPasswordFormSchema) => {
    // check if the email is available
    // if not, throw an error
    // if the email is available, create a password reset token and send an email

    console.log(email);
    router.push('/check-email');
  };

  return (
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="email" className="text-slate-500">
          Email
        </Label>

        <Input id="email" type="email" className="bg-background mt-2" {...register('email')} />

        {errors.email && <span className="mt-1 text-xs text-red-500">{errors.email.message}</span>}
      </div>

      <Button size="lg" disabled={isSubmitting} className="dark:bg-documenso dark:hover:opacity-90">
        {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
        Reset Password
      </Button>
    </form>
  );
};
