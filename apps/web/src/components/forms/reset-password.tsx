'use client';

<<<<<<< HEAD
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
=======
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
>>>>>>> main
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
<<<<<<< HEAD
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
=======
import { ZPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
>>>>>>> main
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZResetPasswordFormSchema = z
  .object({
<<<<<<< HEAD
    password: z.string().min(6).max(72),
    repeatedPassword: z.string().min(6).max(72),
=======
    password: ZPasswordSchema,
    repeatedPassword: ZPasswordSchema,
>>>>>>> main
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

<<<<<<< HEAD
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TResetPasswordFormSchema>({
=======
  const form = useForm<TResetPasswordFormSchema>({
>>>>>>> main
    values: {
      password: '',
      repeatedPassword: '',
    },
    resolver: zodResolver(ZResetPasswordFormSchema),
  });

<<<<<<< HEAD
=======
  const isSubmitting = form.formState.isSubmitting;

>>>>>>> main
  const { mutateAsync: resetPassword } = trpc.profile.resetPassword.useMutation();

  const onFormSubmit = async ({ password }: Omit<TResetPasswordFormSchema, 'repeatedPassword'>) => {
    try {
      await resetPassword({
        password,
        token,
      });

<<<<<<< HEAD
      reset();
=======
      form.reset();
>>>>>>> main

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
<<<<<<< HEAD
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="password" className="text-muted-foreground">
          <span>Password</span>
        </Label>

        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            className="bg-background mt-2 pr-10"
            {...register('password')}
          />

          <Button
            variant="link"
            type="button"
            className="absolute right-0 top-0 flex h-full items-center justify-center pr-3"
            aria-label={showPassword ? 'Mask password' : 'Reveal password'}
            onClick={() => setShowPassword((show) => !show)}
          >
            {showPassword ? (
              <EyeOff className="text-muted-foreground h-5 w-5" />
            ) : (
              <Eye className="text-muted-foreground h-5 w-5" />
            )}
          </Button>
        </div>

        <FormErrorMessage className="mt-1.5" error={errors.password} />
      </div>

      <div>
        <Label htmlFor="repeatedPassword" className="text-muted-foreground">
          <span>Repeat Password</span>
        </Label>

        <div className="relative">
          <Input
            id="repeated-password"
            type={showConfirmPassword ? 'text' : 'password'}
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            className="bg-background mt-2 pr-10"
            {...register('repeatedPassword')}
          />

          <Button
            variant="link"
            type="button"
            className="absolute right-0 top-0 flex h-full items-center justify-center pr-3"
            aria-label={showConfirmPassword ? 'Mask password' : 'Reveal password'}
            onClick={() => setShowConfirmPassword((show) => !show)}
          >
            {showConfirmPassword ? (
              <EyeOff className="text-muted-foreground h-5 w-5" />
            ) : (
              <Eye className="text-muted-foreground h-5 w-5" />
            )}
          </Button>
        </div>

        <FormErrorMessage className="mt-1.5" error={errors.repeatedPassword} />
      </div>

      <Button size="lg" loading={isSubmitting}>
        {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
      </Button>
    </form>
=======
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput {...field} />
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
                <FormLabel>Repeat Password</FormLabel>
                <FormControl>
                  <PasswordInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button type="submit" size="lg" loading={isSubmitting}>
          {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
        </Button>
      </form>
    </Form>
>>>>>>> main
  );
};
