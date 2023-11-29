'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { FcGoogle } from 'react-icons/fc';
import { z } from 'zod';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

const ERROR_MESSAGES = {
  [ErrorCode.CREDENTIALS_NOT_FOUND]: 'The email or password provided is incorrect',
  [ErrorCode.INCORRECT_EMAIL_PASSWORD]: 'The email or password provided is incorrect',
  [ErrorCode.USER_MISSING_PASSWORD]:
    'This account appears to be using a social login method, please sign in using that method',
};

const LOGIN_REDIRECT_PATH = '/documents';

export const ZSignInFormSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(6, { message: 'Invalid password' }).max(72),
});

export type TSignInFormSchema = z.infer<typeof ZSignInFormSchema>;

export type SignInFormProps = {
  className?: string;
};

export const SignInForm = ({ className }: SignInFormProps) => {
  const { toast } = useToast();

  const form = useForm<TSignInFormSchema>({
    values: {
      email: '',
      password: '',
    },
    resolver: zodResolver(ZSignInFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async ({ email, password }: TSignInFormSchema) => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl: LOGIN_REDIRECT_PATH,
        redirect: false,
      });

      if (result?.error && isErrorCode(result.error)) {
        toast({
          variant: 'destructive',
          description: ERROR_MESSAGES[result.error],
        });

        return;
      }

      if (!result?.url) {
        throw new Error('An unknown error occurred');
      }

      window.location.href = result.url;
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
      await signIn('google', { callbackUrl: LOGIN_REDIRECT_PATH });
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
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
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

        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          disabled={isSubmitting}
          className="dark:bg-documenso dark:hover:opacity-90"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>

        <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground bg-transparent">Or continue with</span>
          <div className="bg-border h-px flex-1" />
        </div>

        <Button
          type="button"
          size="lg"
          variant={'outline'}
          className="bg-background text-muted-foreground border"
          disabled={isSubmitting}
          onClick={onSignInWithGoogleClick}
        >
          <FcGoogle className="mr-2 h-5 w-5" />
          Google
        </Button>
      </form>
    </Form>
  );
};
