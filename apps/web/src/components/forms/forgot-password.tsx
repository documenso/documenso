'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZForgotPasswordFormSchema = z.object({
  email: z.string().email().min(1),
});

export type TForgotPasswordFormSchema = z.infer<typeof ZForgotPasswordFormSchema>;

export type ForgotPasswordFormProps = {
  className?: string;
};

export const ForgotPasswordForm = ({ className }: ForgotPasswordFormProps) => {
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TForgotPasswordFormSchema>({
    values: {
      email: '',
    },
    resolver: zodResolver(ZForgotPasswordFormSchema),
  });

  const { mutateAsync: forgotPassword } = trpc.profile.forgotPassword.useMutation();

  const onFormSubmit = async ({ email }: TForgotPasswordFormSchema) => {
    await forgotPassword({ email }).catch(() => null);

    toast({
      title: 'Reset email sent',
      description:
        'A password reset email has been sent, if you have an account you should see it in your inbox shortly.',
      duration: 5000,
    });

    reset();

    router.push('/check-email');
  };

  return (
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="email" className="text-muted-foreground">
          Email
        </Label>

        <Input id="email" type="email" className="bg-background mt-2" {...register('email')} />

        <FormErrorMessage className="mt-1.5" error={errors.email} />
      </div>

      <Button size="lg" loading={isSubmitting}>
        {isSubmitting ? 'Sending Reset Email...' : 'Reset Password'}
      </Button>
    </form>
  );
};
