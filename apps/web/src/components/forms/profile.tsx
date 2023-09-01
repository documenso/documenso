'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { User } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { FormErrorMessage } from '../form/form-error-message';

export const ZProfileFormSchema = z.object({
  name: z.string().min(1),
  signature: z.string().min(1, 'Signature Pad cannot be empty'),
});

export type TProfileFormSchema = z.infer<typeof ZProfileFormSchema>;

export type ProfileFormProps = {
  className?: string;
  user: User;
};

export const ProfileForm = ({ className, user }: ProfileFormProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TProfileFormSchema>({
    values: {
      name: user.name ?? '',
      signature: '',
    },
    resolver: zodResolver(ZProfileFormSchema),
  });

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
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="full-name" className="text-slate-500">
          Full Name
        </Label>

        <Input id="full-name" type="text" className="bg-background mt-2" {...register('name')} />

        <FormErrorMessage className="mt-1.5" error={errors.name} />
      </div>

      <div>
        <Label htmlFor="email" className="text-slate-500">
          Email
        </Label>

        <Input id="email" type="email" className="bg-muted mt-2" value={user.email} disabled />
      </div>

      <div>
        <Label htmlFor="signature" className="text-slate-500">
          Signature
        </Label>

        <div className="mt-2">
          <Controller
            control={control}
            name="signature"
            render={({ field: { onChange } }) => (
              <SignaturePad
                className="h-44 w-full rounded-lg border bg-white backdrop-blur-sm dark:border-[#e2d7c5] dark:bg-[#fcf8ee]"
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
  );
};
