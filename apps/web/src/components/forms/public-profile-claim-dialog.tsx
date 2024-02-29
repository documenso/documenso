'use client';

import React, { useState } from 'react';

import Image from 'next/image';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import profileClaimTeaserImage from '@documenso/assets/images/profile-claim-teaser.png';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { User } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { UserProfileSkeleton } from '../ui/user-profile-skeleton';

export const ZClaimPublicProfileFormSchema = z.object({
  url: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'Please enter a valid username.' })
    .regex(/^[a-z0-9-]+$/, {
      message: 'Username can only container alphanumeric characters and dashes.',
    }),
});

export type TClaimPublicProfileFormSchema = z.infer<typeof ZClaimPublicProfileFormSchema>;

export type ClaimPublicProfileDialogFormProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClaimed?: () => void;
  user: User;
};

export const ClaimPublicProfileDialogForm = ({
  open,
  onOpenChange,
  onClaimed,
  user,
}: ClaimPublicProfileDialogFormProps) => {
  const { toast } = useToast();

  const [claimed, setClaimed] = useState(false);

  const baseUrl = new URL(NEXT_PUBLIC_WEBAPP_URL() ?? 'http://localhost:3000');

  const form = useForm<TClaimPublicProfileFormSchema>({
    values: {
      url: user.url || '',
    },
    resolver: zodResolver(ZClaimPublicProfileFormSchema),
  });

  const { mutateAsync: updatePublicProfile } = trpc.profile.updatePublicProfile.useMutation();

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async ({ url }: TClaimPublicProfileFormSchema) => {
    try {
      await updatePublicProfile({
        url,
      });

      setClaimed(true);
      onClaimed?.();
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.PROFILE_URL_TAKEN) {
        form.setError('url', {
          type: 'manual',
          message: 'This username is already taken',
        });
      } else if (error.code === AppErrorCode.PREMIUM_PROFILE_URL) {
        form.setError('url', {
          type: 'manual',
          message: error.message,
        });
      } else if (error.code !== AppErrorCode.UNKNOWN_ERROR) {
        toast({
          title: 'An error occurred',
          description: error.userMessage ?? error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          description:
            'We encountered an unknown error while attempting to save your details. Please try again later.',
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent position="center" className="max-w-lg overflow-hidden">
        {!claimed && (
          <>
            <DialogHeader>
              <DialogTitle className="font-semi-bold text-center text-xl">
                Introducing public profiles!
              </DialogTitle>

              <DialogDescription className="text-center">
                Reserve your Documenso public profile username
              </DialogDescription>
            </DialogHeader>

            <Image src={profileClaimTeaserImage} alt="profile claim teaser" />

            <Form {...form}>
              <form
                className={cn(
                  'to-background -mt-32 flex w-full flex-col bg-gradient-to-b from-transparent to-15% pt-16 md:-mt-44',
                )}
                onSubmit={form.handleSubmit(onFormSubmit)}
              >
                <fieldset className="-mt-6 flex w-full flex-col gap-y-4" disabled={isSubmitting}>
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Public profile username</FormLabel>

                        <FormControl>
                          <Input type="text" className="mb-2 mt-2" {...field} />
                        </FormControl>

                        <FormMessage />

                        <div className="bg-muted/50 text-muted-foreground mt-2 inline-block truncate rounded-md px-2 py-1 text-sm">
                          {baseUrl.host}/u/{field.value || '<username>'}
                        </div>
                      </FormItem>
                    )}
                  />
                </fieldset>

                <div className="mt-4 text-center">
                  <Button type="submit" loading={isSubmitting}>
                    Claim your username
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}

        {claimed && (
          <>
            <DialogHeader>
              <DialogTitle className="font-semi-bold text-center text-xl">All set!</DialogTitle>

              <DialogDescription className="text-center">
                We will let you know as soon as this features is launched
              </DialogDescription>
            </DialogHeader>

            <UserProfileSkeleton className="mt-4" user={user} rows={1} />

            <div className="to-background -mt-12 flex w-full flex-col items-center bg-gradient-to-b from-transparent to-15% px-4 pt-8 md:-mt-12">
              <Button className="w-full" onClick={() => onOpenChange?.(false)}>
                Can't wait!
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
