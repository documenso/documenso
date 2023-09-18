'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
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
    try {
      await forgotPassword({ email });

      toast({
        title: 'Reset email sent',
        description: 'Your password reset mail has been sent successfully.',
        duration: 5000,
      });

      reset();
      router.push('/check-email');
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
            'We encountered an unknown error while attempting to send your email. Please try again later.',
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
