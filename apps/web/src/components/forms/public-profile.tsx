'use client';

import { useRef } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Copy } from 'lucide-react';
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
  profileURL: z.string().trim().min(1, { message: 'Please enter a valid URL slug.' }),
  profileBio: z
    .string()
    .max(256, { message: 'Profile bio must not exceed 256 characters' })
    .optional(),
});

export type TPublicProfileFormSchema = z.infer<typeof ZPublicProfileFormSchema>;

export type PublicProfileFormProps = {
  className?: string;
  user: User;
};

export const PublicProfileForm = ({ user, className }: PublicProfileFormProps) => {
  const textRef = useRef<HTMLSpanElement>(null);

  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<TPublicProfileFormSchema>({
    values: {
      profileURL: user.profileURL || '',
    },
    resolver: zodResolver(ZPublicProfileFormSchema),
  });

  const isSaving = form.formState.isSubmitting;

  const { mutateAsync: updatePublicProfile, data: profileURL } =
    trpc.profile.updatePublicProfile.useMutation();

  const copyTextToClipboard = async () => {
    if (textRef.current) {
      try {
        await navigator.clipboard.writeText(textRef.current.textContent || '');
      } catch (err) {
        console.log('Failed to copy: ', err);
      }
    }
  };

  const onFormSubmit = async ({ profileURL, profileBio }: TPublicProfileFormSchema) => {
    try {
      await updatePublicProfile({
        profileURL,
        profileBio: profileBio || '',
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
            'We encountered an unknown error while attempting to save your details. Please try again later.',
        });
      }
    }
  };

  return (
    <Form {...form}>
      <form
        className={(cn('flex w-full flex-col gap-y-4'), className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset className="flex w-full flex-col gap-y-4" disabled={isSaving}>
          <FormField
            control={form.control}
            name="profileURL"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Public profile URL</FormLabel>
                <FormControl>
                  <>
                    <Input type="text" className="mb-2 mt-2" {...field} />
                    {profileURL && (
                      <code className="bg-muted rounded-md px-1 py-1 text-sm">
                        <span ref={textRef} id="textToCopy">
                          {profileURL}
                        </span>
                        <Button
                          className="pointer-events-none w-12 px-0"
                          onClick={copyTextToClipboard}
                          variant="ghost"
                          asChild
                        >
                          <Copy className="h-8 w-8" />
                        </Button>
                      </code>
                    )}
                  </>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="profileBio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea className="mt-2" placeholder="Write about yourself..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <div className="ml-auto mt-4">
          <Button type="submit" loading={isSaving}>
            {isSaving ? 'Saving changes...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
