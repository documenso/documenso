'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZResetPasswordFormSchema = z
  .object({
    password: z.string().min(6).max(72),
    repeatedPassword: z.string().min(6).max(72),
  })
  .refine((data) => data.password === data.repeatedPassword, {
    path: ['repeatedPassword'],
    message: "Passwords don't match",
  });

export type TResetPasswordFormSchema = z.infer<typeof ZResetPasswordFormSchema>;

export type ResetPasswordFormProps = {
  className?: string;
  token: string;
};

export const ResetPasswordForm = ({ className, token }: ResetPasswordFormProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TResetPasswordFormSchema>({
    values: {
      password: '',
      repeatedPassword: '',
    },
    resolver: zodResolver(ZResetPasswordFormSchema),
  });

  const { mutateAsync: resetPassword } = trpc.profile.resetPassword.useMutation();

  const onFormSubmit = async ({ password }: Omit<TResetPasswordFormSchema, 'repeatedPassword'>) => {
    try {
      await resetPassword({
        password,
        token,
      });

      reset();

      toast({
        title: 'Password updated',
        description: 'Your password has been updated successfully.',
        duration: 5000,
      });

      router.push('/signin');
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'An error occurred',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          description:
            'We encountered an unknown error while attempting to reset your password. Please try again later.',
        });
      }
    }
  };

  return (
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="password" className="text-muted-foreground">
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

        <FormErrorMessage className="mt-1.5" error={errors.password} />
      </div>

      <div>
        <Label htmlFor="repeatedPassword" className="text-muted-foreground">
          <span>Repeat Password</span>
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

        <FormErrorMessage className="mt-1.5" error={errors.repeatedPassword} />
      </div>

      <Button size="lg" loading={isSubmitting}>
        Reset Password
      </Button>
    </form>
  );
};
