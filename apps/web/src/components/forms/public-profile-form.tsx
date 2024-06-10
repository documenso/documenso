'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { CheckSquareIcon, CopyIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { formatUserProfilePath } from '@documenso/lib/utils/public-profiles';
import type { TeamProfile, UserProfile } from '@documenso/prisma/client';
import {
  MAX_PROFILE_BIO_LENGTH,
  ZUpdatePublicProfileMutationSchema,
} from '@documenso/trpc/server/profile-router/schema';
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

export const ZPublicProfileFormSchema = ZUpdatePublicProfileMutationSchema.pick({
  bio: true,
  enabled: true,
  url: true,
});

export type TPublicProfileFormSchema = z.infer<typeof ZPublicProfileFormSchema>;

export type PublicProfileFormProps = {
  className?: string;
  profileUrl?: string | null;
  teamUrl?: string;
  onProfileUpdate: (data: TPublicProfileFormSchema) => Promise<unknown>;
  profile: UserProfile | TeamProfile;
};
export const PublicProfileForm = ({
  className,
  profileUrl,
  profile,
  teamUrl,
  onProfileUpdate,
}: PublicProfileFormProps) => {
  const { toast } = useToast();

  const [, copy] = useCopyToClipboard();

  const [copiedTimeout, setCopiedTimeout] = useState<NodeJS.Timeout | null>(null);

  const form = useForm<TPublicProfileFormSchema>({
    values: {
      url: profileUrl ?? '',
      bio: profile?.bio ?? '',
    },
    resolver: zodResolver(ZPublicProfileFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async (data: TPublicProfileFormSchema) => {
    try {
      await onProfileUpdate(data);

      toast({
        title: 'Success',
        description: 'Your public profile has been updated.',
        duration: 5000,
      });

      form.reset({
        url: data.url,
        bio: data.bio,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      switch (error.code) {
        case AppErrorCode.PREMIUM_PROFILE_URL:
        case AppErrorCode.PROFILE_URL_TAKEN:
          form.setError('url', {
            type: 'manual',
            message: error.message,
          });

          break;

        default:
          toast({
            title: 'An unknown error occurred',
            variant: 'destructive',
            description:
              'We encountered an unknown error while attempting to update your public profile. Please try again later.',
          });
      }
    }
  };

  const onCopy = async () => {
    await copy(formatUserProfilePath(form.getValues('url') ?? '')).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'The profile link has been copied to your clipboard',
      });
    });

    if (copiedTimeout) {
      clearTimeout(copiedTimeout);
    }

    setCopiedTimeout(
      setTimeout(() => {
        setCopiedTimeout(null);
      }, 2000),
    );
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
                  <Input {...field} disabled={field.disabled || teamUrl !== undefined} />
                </FormControl>

                {teamUrl && (
                  <p className="text-muted-foreground text-xs">
                    You can update the profile URL by updating the team URL in the general settings
                    page.
                  </p>
                )}

                <div className="h-8">
                  {!form.formState.errors.url && (
                    <div className="text-muted-foreground h-8 text-sm">
                      {field.value ? (
                        <div>
                          <Button
                            type="button"
                            variant="none"
                            className="h-7 rounded bg-neutral-50 pl-2 pr-0.5 font-normal dark:border dark:border-neutral-500 dark:bg-neutral-600"
                            onClick={async () => onCopy()}
                          >
                            <p>
                              {formatUserProfilePath('').replace(/https?:\/\//, '')}
                              <span className="font-semibold">{field.value}</span>
                            </p>

                            <div className="ml-1 flex h-6 w-6 items-center justify-center rounded transition-all hover:bg-neutral-200 hover:active:bg-neutral-300 dark:hover:bg-neutral-500 dark:hover:active:bg-neutral-400">
                              <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                  key={copiedTimeout ? 'copied' : 'copy'}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                                  className="absolute"
                                >
                                  {copiedTimeout ? (
                                    <CheckSquareIcon className="h-3.5 w-3.5" />
                                  ) : (
                                    <CopyIcon className="h-3.5 w-3.5" />
                                  )}
                                </motion.div>
                              </AnimatePresence>
                            </div>
                          </Button>
                        </div>
                      ) : (
                        <p>A unique URL to access your profile</p>
                      )}
                    </div>
                  )}

                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => {
              const remaningLength = MAX_PROFILE_BIO_LENGTH - (field.value || '').length;
              const pluralWord = Math.abs(remaningLength) === 1 ? 'character' : 'characters';

              return (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={teamUrl ? 'Write about the team' : 'Write about yourself'}
                    />
                  </FormControl>

                  {!form.formState.errors.bio && (
                    <p className="text-muted-foreground text-sm">
                      {remaningLength >= 0
                        ? `${remaningLength} ${pluralWord} remaining`
                        : `${Math.abs(remaningLength)} ${pluralWord} over the limit`}
                    </p>
                  )}

                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <div className="flex flex-row justify-end space-x-4">
            <AnimatePresence>
              {form.formState.isDirty && (
                <motion.div
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                >
                  <Button type="button" variant="secondary" onClick={() => form.reset()}>
                    Reset
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="transition-opacity"
              disabled={!form.formState.isDirty}
              loading={form.formState.isSubmitting}
            >
              Update
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
