'use client';

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
    name: z.string().trim().min(1, { message: 'გთხოვთ შეიყვანოთ სწორი სახელი.' }),
    email: z.string().email().min(1),
    password: ZPasswordSchema,
    signature: z
      .string()
      .min(1, { message: 'დოკუმენტების გასაფორმებლად თქვენი ხელმოწერაა საჭირო' }),
  })
  .refine(
    (data) => {
      const { name, email, password } = data;
      return !password.includes(name) && !password.includes(email.split('@')[0]);
    },
    {
      message: 'პაროლი უნდა იყოს უნიკალური და არ უნდა ეფუძნებოდეს პირად მონაცემებს.',
    },
  );

export type TSignUpFormSchema = z.infer<typeof ZSignUpFormSchema>;

export type SignUpFormProps = {
  className?: string;
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
      password: '',
      signature: '',
    },
    resolver: zodResolver(ZSignUpFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const { mutateAsync: signup } = trpc.auth.signup.useMutation();

  const onFormSubmit = async ({ name, email, password, signature }: TSignUpFormSchema) => {
    try {
      await signup({ name, email, password, signature });

      router.push(`/unverified-account`);

      toast({
        title: 'რეგისტრაცია წარმატებულია',
        description:
          'თქვენ წარმატებით დარეგისტრირდით! გთხოვთ დაადასტუროთ ეს თქვენს ელ.ფოსტაზე გამოგზავნილ ბმულზე გადასვლით.',
        duration: 5000,
      });

      analytics.capture('App: User Sign Up', {
        email,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description:
            'რეგისტრირების დროს დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
          variant: 'destructive',
        });
      }
    }
  };

  const onSignUpWithGoogleClick = async () => {
    try {
      await signIn('google', { callbackUrl: SIGN_UP_REDIRECT_PATH });
    } catch (err) {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        description:
          'რეგისტრირების დროს დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
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
                <FormLabel>სახელი</FormLabel>
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
                <FormLabel>ელ.ფოსტა</FormLabel>
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
                <FormLabel>პაროლი</FormLabel>
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
                <FormLabel>მოაწერეთ აქ</FormLabel>
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
          {isSubmitting ? 'რეგისტრაცია...' : 'რეგისტრაცია'}
        </Button>

        {isGoogleSSOEnabled && (
          <>
            <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground bg-transparent">ან</span>
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
              დარეგისტრირდით Google-ით
            </Button>
          </>
        )}
      </form>
    </Form>
  );
};
