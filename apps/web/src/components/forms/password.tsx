'use client';

<<<<<<< HEAD
import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { User } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { FormErrorMessage } from '../form/form-error-message';

export const ZPasswordFormSchema = z
  .object({
    currentPassword: z.string().min(6).max(72),
    password: z.string().min(6).max(72),
    repeatedPassword: z.string().min(6).max(72),
=======
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { User } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { ZCurrentPasswordSchema, ZPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZPasswordFormSchema = z
  .object({
    currentPassword: ZCurrentPasswordSchema,
    password: ZPasswordSchema,
    repeatedPassword: ZPasswordSchema,
>>>>>>> main
  })
  .refine((data) => data.password === data.repeatedPassword, {
    message: 'Passwords do not match',
    path: ['repeatedPassword'],
  });

export type TPasswordFormSchema = z.infer<typeof ZPasswordFormSchema>;

export type PasswordFormProps = {
  className?: string;
  user: User;
};

export const PasswordForm = ({ className }: PasswordFormProps) => {
  const { toast } = useToast();

<<<<<<< HEAD
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TPasswordFormSchema>({
=======
  const form = useForm<TPasswordFormSchema>({
>>>>>>> main
    values: {
      currentPassword: '',
      password: '',
      repeatedPassword: '',
    },
    resolver: zodResolver(ZPasswordFormSchema),
  });

<<<<<<< HEAD
=======
  const isSubmitting = form.formState.isSubmitting;

>>>>>>> main
  const { mutateAsync: updatePassword } = trpc.profile.updatePassword.useMutation();

  const onFormSubmit = async ({ currentPassword, password }: TPasswordFormSchema) => {
    try {
      await updatePassword({
        currentPassword,
        password,
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
            'We encountered an unknown error while attempting to update your password. Please try again later.',
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
        <Label htmlFor="current-password" className="text-muted-foreground">
          Current Password
        </Label>

        <div className="relative">
          <Input
            id="current-password"
            type={showCurrentPassword ? 'text' : 'password'}
            minLength={6}
            maxLength={72}
            autoComplete="current-password"
            className="bg-background mt-2 pr-10"
            {...register('currentPassword')}
          />

          <Button
            variant="link"
            type="button"
            className="absolute right-0 top-0 flex h-full items-center justify-center pr-3"
            aria-label={showCurrentPassword ? 'Mask password' : 'Reveal password'}
            onClick={() => setShowCurrentPassword((show) => !show)}
          >
            {showCurrentPassword ? (
              <EyeOff className="text-muted-foreground h-5 w-5" />
            ) : (
              <Eye className="text-muted-foreground h-5 w-5" />
            )}
          </Button>
        </div>

        <FormErrorMessage className="mt-1.5" error={errors.currentPassword} />
      </div>
      <div>
        <Label htmlFor="password" className="text-muted-foreground">
          Password
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
        <Label htmlFor="repeated-password" className="text-muted-foreground">
          Repeat Password
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

      <div className="mt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
          Update password
        </Button>
      </div>
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
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
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
                <FormLabel>Password</FormLabel>
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
                <FormLabel>Repeat Password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <div className="ml-auto mt-4">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Updating password...' : 'Update password'}
          </Button>
        </div>
      </form>
    </Form>
>>>>>>> main
  );
};
