'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
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

export type ClaimAccountProps = {
  userName: string;
  userEmail: string;
  trigger?: React.ReactNode;
};

export const ZClaimAccountFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
  email: z.string().email().min(1),
  password: z.string().min(8),
});

export type TClaimAccountFormSchema = z.infer<typeof ZClaimAccountFormSchema>;

export const ClaimAccount = ({ userName, userEmail }: ClaimAccountProps) => {
  const analytics = useAnalytics();
  const { toast } = useToast();
  const router = useRouter();

  const { mutateAsync: signup } = trpc.auth.signup.useMutation();

  const form = useForm<TClaimAccountFormSchema>({
    values: {
      name: userName ?? '',
      email: userEmail,
      password: '',
    },
    resolver: zodResolver(ZClaimAccountFormSchema),
  });

  const onFormSubmit = async ({ name, email, password }: TClaimAccountFormSchema) => {
    try {
      await signup({ name, email, password, signature: 'undefined' });

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
      });
    } catch (error) {
      console.log(error);
      if (error instanceof TRPCClientError && error.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'An error occurred',
          description: error.message,
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
    <div className="mt-2 w-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)}>
          <fieldset disabled={form.formState.isSubmitting} className="mt-4">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter your name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input {...field} value={userEmail} placeholder="Enter your email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="password"
              control={form.control}
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Set a password</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} placeholder="Pick a password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="mt-6 w-full" loading={form.formState.isSubmitting}>
              Claim account
            </Button>
          </fieldset>
        </form>
      </Form>
    </div>
  );
};
