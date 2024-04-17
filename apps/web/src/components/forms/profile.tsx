'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
<<<<<<< HEAD
import { Loader } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { User } from '@documenso/prisma/client';
=======
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { User } from '@documenso/prisma/client';
>>>>>>> main
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
<<<<<<< HEAD
=======
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
>>>>>>> main
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

<<<<<<< HEAD
import { FormErrorMessage } from '../form/form-error-message';

=======
>>>>>>> main
export const ZProfileFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
  signature: z.string().min(1, 'Signature Pad cannot be empty'),
});

<<<<<<< HEAD
=======
export const ZTwoFactorAuthTokenSchema = z.object({
  token: z.string(),
});

export type TTwoFactorAuthTokenSchema = z.infer<typeof ZTwoFactorAuthTokenSchema>;
>>>>>>> main
export type TProfileFormSchema = z.infer<typeof ZProfileFormSchema>;

export type ProfileFormProps = {
  className?: string;
  user: User;
};

export const ProfileForm = ({ className, user }: ProfileFormProps) => {
  const router = useRouter();

  const { toast } = useToast();

<<<<<<< HEAD
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TProfileFormSchema>({
=======
  const form = useForm<TProfileFormSchema>({
>>>>>>> main
    values: {
      name: user.name ?? '',
      signature: user.signature || '',
    },
    resolver: zodResolver(ZProfileFormSchema),
  });

<<<<<<< HEAD
=======
  const isSubmitting = form.formState.isSubmitting;

>>>>>>> main
  const { mutateAsync: updateProfile } = trpc.profile.updateProfile.useMutation();

  const onFormSubmit = async ({ name, signature }: TProfileFormSchema) => {
    try {
      await updateProfile({
        name,
        signature,
      });

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
        duration: 5000,
      });

      router.refresh();
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

  return (
<<<<<<< HEAD
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="full-name" className="text-muted-foreground">
          Full Name
        </Label>

        <Input id="full-name" type="text" className="bg-background mt-2" {...register('name')} />

        <FormErrorMessage className="mt-1.5" error={errors.name} />
      </div>

      <div>
        <Label htmlFor="email" className="text-muted-foreground">
          Email
        </Label>

        <Input id="email" type="email" className="bg-muted mt-2" value={user.email} disabled />
      </div>

      <div>
        <Label htmlFor="signature" className="text-muted-foreground">
          Signature
        </Label>

        <div className="mt-2">
          <Controller
            control={control}
            name="signature"
            render={({ field: { onChange } }) => (
              <SignaturePad
                className="h-44 w-full"
                containerClassName="rounded-lg border bg-background"
                defaultValue={user.signature ?? undefined}
                onChange={(v) => onChange(v ?? '')}
              />
            )}
          />
          <FormErrorMessage className="mt-1.5" error={errors.signature} />
        </div>
      </div>

      <div className="mt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
          Update profile
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Label htmlFor="email" className="text-muted-foreground">
              Email
            </Label>
            <Input id="email" type="email" className="bg-muted mt-2" value={user.email} disabled />
          </div>
          <FormField
            control={form.control}
            name="signature"
            render={({ field: { onChange } }) => (
              <FormItem>
                <FormLabel>Signature</FormLabel>
                <FormControl>
                  <SignaturePad
                    className="h-44 w-full"
                    disabled={isSubmitting}
                    containerClassName={cn('rounded-lg border bg-background')}
                    defaultValue={user.signature ?? undefined}
                    onChange={(v) => onChange(v ?? '')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button type="submit" loading={isSubmitting} className="self-end">
          {isSubmitting ? 'Updating profile...' : 'Update profile'}
        </Button>
      </form>
    </Form>
>>>>>>> main
  );
};
