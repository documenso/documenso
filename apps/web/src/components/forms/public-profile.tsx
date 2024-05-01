'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { User } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
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
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZPublicProfileFormSchema = z.object({
  url: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'Please enter a valid username.' })
    .regex(/^[a-z0-9-]+$/, {
      message: 'Username can only container alphanumeric characters and dashes.',
    }),
  bio: z
    .string()
    .trim()
    .max(256, {
      message: 'Bio cannot be longer than 256 characters.',
    })
    .optional(),
});

export type TPublicProfileFormSchema = z.infer<typeof ZPublicProfileFormSchema>;

export type PublicProfileFormProps = {
  className?: string;
  user: User;
};

export const PublicProfileForm = ({ className, user }: PublicProfileFormProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const form = useForm<TPublicProfileFormSchema>({
    values: {
      url: user.url || '',
    },
    resolver: zodResolver(ZPublicProfileFormSchema),
  });

  const watchedBio = form.watch('bio');

  const { mutateAsync: updatePublicProfile } = trpc.profile.updatePublicProfile.useMutation();

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async ({ url, bio }: TPublicProfileFormSchema) => {
    try {
      await updatePublicProfile({
        url,
        bio: bio ?? '',
      });

      toast({
        title: 'Public profile updated',
        description: 'Your public profile has been updated successfully.',
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
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Public profile URL</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <>
                    <Textarea placeholder="Write about yourself..." {...field} />
                    <div className="text-muted-foreground text-left text-sm">
                      {256 - (watchedBio?.length || 0)} characters remaining
                    </div>
                  </>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button type="submit" loading={isSubmitting} className="self-end">
          {isSubmitting ? 'Saving changes...' : 'Save changes'}
        </Button>
      </form>
    </Form>
  );
};
