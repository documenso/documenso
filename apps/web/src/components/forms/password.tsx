'use client';

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
    password: z.string().min(6),
    repeatedPassword: z.string().min(6),
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TPasswordFormSchema>({
    values: {
      password: '',
      repeatedPassword: '',
    },
    resolver: zodResolver(ZPasswordFormSchema),
  });

  const { mutateAsync: updatePassword } = trpc.profile.updatePassword.useMutation();

  const onFormSubmit = async ({ password }: TPasswordFormSchema) => {
    try {
      await updatePassword({
        password,
      });

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
            'We encountered an unknown error while attempting to sign you In. Please try again later.',
        });
      }
    }
  };

  const onShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const onShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="password" className="text-slate-500">
          Password
        </Label>

        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className="bg-background mt-2"
            {...register('password')}
          />

          <Button
            variant="link"
            type="button"
            className="absolute right-0 top-0 flex h-full items-center justify-center"
            aria-label={showPassword ? 'Mask password' : 'Reveal password'}
            onClick={onShowPassword}
          >
            {showPassword ? (
              <EyeOff className="text-slate-500" />
            ) : (
              <Eye className="text-slate-500" />
            )}
          </Button>
        </div>

        <FormErrorMessage className="mt-1.5" error={errors.password} />
      </div>

      <div>
        <Label htmlFor="repeated-password" className="text-slate-500">
          Repeat Password
        </Label>

        <div className="relative">
          <Input
            id="repeated-password"
            type={showConfirmPassword ? 'text' : 'password'}
            className="bg-background mt-2"
            {...register('repeatedPassword')}
          />

          <Button
            variant="link"
            type="button"
            className="absolute right-0 top-0 flex h-full items-center justify-center"
            aria-label={showConfirmPassword ? 'Mask password' : 'Reveal password'}
            onClick={onShowConfirmPassword}
          >
            {showConfirmPassword ? (
              <EyeOff className="text-slate-500" />
            ) : (
              <Eye className="text-slate-500" />
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
  );
};
