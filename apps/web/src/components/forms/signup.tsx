'use client';

<<<<<<< HEAD
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
=======
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { FcGoogle } from 'react-icons/fc';
import { z } from 'zod';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
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
import { Input } from '@documenso/ui/primitives/input';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

const SIGN_UP_REDIRECT_PATH = '/documents';

export const ZSignUpFormSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
    email: z.string().email().min(1),
    password: ZPasswordSchema,
    signature: z.string().min(1, { message: 'We need your signature to sign documents' }),
  })
  .refine(
    (data) => {
      const { name, email, password } = data;
      return !password.includes(name) && !password.includes(email.split('@')[0]);
    },
    {
      message: 'Password should not be common or based on personal information',
    },
  );
>>>>>>> main

export type TSignUpFormSchema = z.infer<typeof ZSignUpFormSchema>;

export type SignUpFormProps = {
  className?: string;
<<<<<<< HEAD
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
=======
  initialEmail?: string;
  isGoogleSSOEnabled?: boolean;
};

export const SignUpForm = ({ className, initialEmail, isGoogleSSOEnabled }: SignUpFormProps) => {
  const { toast } = useToast();
  const analytics = useAnalytics();
  const router = useRouter();

  const form = useForm<TSignUpFormSchema>({
    values: {
      name: '',
      email: initialEmail ?? '',
>>>>>>> main
      password: '',
      signature: '',
    },
    resolver: zodResolver(ZSignUpFormSchema),
  });

<<<<<<< HEAD
=======
  const isSubmitting = form.formState.isSubmitting;

>>>>>>> main
  const { mutateAsync: signup } = trpc.auth.signup.useMutation();

  const onFormSubmit = async ({ name, email, password, signature }: TSignUpFormSchema) => {
    try {
      await signup({ name, email, password, signature });

<<<<<<< HEAD
      await signIn('credentials', {
        email,
        password,
        callbackUrl: '/',
=======
      router.push(`/unverified-account`);

      toast({
        title: 'Registration Successful',
        description:
          'You have successfully registered. Please verify your account by clicking on the link you received in the email.',
        duration: 5000,
      });

      analytics.capture('App: User Sign Up', {
        email,
        timestamp: new Date().toISOString(),
>>>>>>> main
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

<<<<<<< HEAD
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
=======
  const onSignUpWithGoogleClick = async () => {
    try {
      await signIn('google', { callbackUrl: SIGN_UP_REDIRECT_PATH });
    } catch (err) {
      toast({
        title: 'An unknown error occurred',
        description:
          'We encountered an unknown error while attempting to sign you Up. Please try again later.',
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
        <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
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
            name="signature"
            render={({ field: { onChange } }) => (
              <FormItem>
                <FormLabel>Sign Here</FormLabel>
                <FormControl>
                  <SignaturePad
                    className="h-36 w-full"
                    disabled={isSubmitting}
                    containerClassName="mt-2 rounded-lg border bg-background"
                    onChange={(v) => onChange(v ?? '')}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          className="dark:bg-documenso dark:hover:opacity-90"
        >
          {isSubmitting ? 'Signing up...' : 'Sign Up'}
        </Button>

        {isGoogleSSOEnabled && (
          <>
            <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground bg-transparent">Or</span>
              <div className="bg-border h-px flex-1" />
            </div>

            <Button
              type="button"
              size="lg"
              variant={'outline'}
              className="bg-background text-muted-foreground border"
              disabled={isSubmitting}
              onClick={onSignUpWithGoogleClick}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              Sign Up with Google
            </Button>
          </>
        )}
      </form>
    </Form>
>>>>>>> main
  );
};
