'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZSignUpFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
  email: z.string().email().min(1),
  password: z.string().min(6).max(72),
  signature: z.string().min(1, { message: 'We need your signature to sign documents' }),
});

export type TSignUpFormSchema = z.infer<typeof ZSignUpFormSchema>;

export type SignUpFormProps = {
  className?: string;
};

export const SignUpForm = ({ className }: SignUpFormProps) => {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TSignUpFormSchema>({
    values: {
      name: '',
      email: '',
      password: '',
      signature: '',
    },
    resolver: zodResolver(ZSignUpFormSchema),
  });

  const { mutateAsync: signup } = trpc.auth.signup.useMutation();

  const onFormSubmit = async ({ name, email, password, signature }: TSignUpFormSchema) => {
    try {
      await signup({ name, email, password, signature });

      await signIn('credentials', {
        email,
        password,
        callbackUrl: '/',
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
          description:
            'We encountered an unknown error while attempting to sign you up. Please try again later.',
          variant: 'destructive',
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
        <Label htmlFor="name" className="text-muted-foreground">
          Name
        </Label>

        <Input id="name" type="text" className="bg-background mt-2" {...register('name')} />

        {errors.name && <span className="mt-1 text-xs text-red-500">{errors.name.message}</span>}
      </div>

      <div>
        <Label htmlFor="email" className="text-muted-foreground">
          Email
        </Label>

        <Input id="email" type="email" className="bg-background mt-2" {...register('email')} />

        {errors.email && <span className="mt-1 text-xs text-red-500">{errors.email.message}</span>}
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
      </div>

      <div>
        <Label htmlFor="password" className="text-muted-foreground">
          Sign Here
        </Label>

        <div>
          <Controller
            control={control}
            name="signature"
            render={({ field: { onChange } }) => (
              <SignaturePad
                className="h-36 w-full"
                containerClassName="mt-2 rounded-lg border bg-background"
                onChange={(v) => onChange(v ?? '')}
              />
            )}
          />
        </div>

        <FormErrorMessage className="mt-1.5" error={errors.signature} />
      </div>

      <Button
        size="lg"
        loading={isSubmitting}
        disabled={isSubmitting}
        className="dark:bg-documenso dark:hover:opacity-90"
      >
        {isSubmitting ? 'Signing up...' : 'Sign Up'}
      </Button>
    </form>
  );
};
