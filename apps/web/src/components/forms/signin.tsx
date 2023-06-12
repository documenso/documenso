'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { FcGoogle } from 'react-icons/fc';
import { z } from 'zod';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZSignInFormSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
});

export type TSignInFormSchema = z.infer<typeof ZSignInFormSchema>;

export type SignInFormProps = {
  className?: string;
};

export const SignInForm = ({ className }: SignInFormProps) => {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TSignInFormSchema>({
    values: {
      email: '',
      password: '',
    },
    resolver: zodResolver(ZSignInFormSchema),
  });

  const onFormSubmit = async ({ email, password }: TSignInFormSchema) => {
    try {
      await signIn('credentials', {
        email,
        password,
        callbackUrl: '/dashboard',
      }).catch((err) => {
        console.error(err);
      });

      // throw new Error('Not implemented');
    } catch (err) {
      toast({
        title: 'An unknown error occurred',
        description:
          'We encountered an unknown error while attempting to sign you In. Please try again later.',
      });
    }
  };

  const onSignInWithGoogleClick = async () => {
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
      // throw new Error('Not implemented');
    } catch (err) {
      toast({
        title: 'An unknown error occurred',
        description:
          'We encountered an unknown error while attempting to sign you In. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(onFormSubmit)();
      }}
    >
      <div>
        <Label htmlFor="email" className="text-slate-500">
          Email
        </Label>

        <Input id="email" type="email" className="mt-2 bg-white" {...register('email')} />

        {errors.email && <span className="mt-1 text-xs text-red-500">{errors.email.message}</span>}
      </div>

      <div>
        <Label htmlFor="password" className="text-slate-500">
          Password
        </Label>

        <Input id="password" type="password" className="mt-2 bg-white" {...register('password')} />

        {errors.password && (
          <span className="mt-1 text-xs text-red-500">{errors.password.message}</span>
        )}
      </div>

      <Button size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
        Sign In
      </Button>

      <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
        <div className="h-px flex-1 bg-slate-300" />
        <span className="bg-transparent text-slate-500">Or continue with</span>
        <div className="h-px flex-1 bg-slate-300" />
      </div>

      <Button
        type="button"
        size="lg"
        variant={'outline'}
        className="border bg-white text-slate-500"
        disabled={isSubmitting}
        onClick={onSignInWithGoogleClick}
      >
        <FcGoogle className="mr-2 h-5 w-5" />
        Google
      </Button>
    </form>
  );
};
