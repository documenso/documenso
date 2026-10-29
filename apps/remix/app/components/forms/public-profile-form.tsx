import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { formatUserProfilePath } from '@documenso/lib/utils/public-profiles';
import { MAX_PROFILE_BIO_LENGTH, ZUpdateTeamRequestSchema } from '@documenso/trpc/server/team-router/update-team.types';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import type { TeamProfile } from '@prisma/client';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useCurrentTeam } from '~/providers/team';

export const ZPublicProfileFormSchema = ZUpdateTeamRequestSchema.shape.data.pick({
  profileBio: true,
  url: true,
});

export type TPublicProfileFormSchema = z.infer<typeof ZPublicProfileFormSchema>;

export type PublicProfileFormProps = {
  className?: string;
  onProfileUpdate: (data: TPublicProfileFormSchema) => Promise<unknown>;
  profile: TeamProfile;
};
export const PublicProfileForm = ({ className, profile, onProfileUpdate }: PublicProfileFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [, copy] = useCopyToClipboard();

  const [copiedTimeout, setCopiedTimeout] = useState<NodeJS.Timeout | null>(null);

  const { organisations } = useSession();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const team = useCurrentTeam();

  const form = useForm<TPublicProfileFormSchema>({
    values: {
      url: team.url,
      profileBio: profile?.bio ?? '',
    },
    resolver: zodResolver(ZPublicProfileFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async (data: TPublicProfileFormSchema) => {
    try {
      await onProfileUpdate(data);

      toast({
        title: _(msg`Success`),
        description: _(msg`Your public profile has been updated.`),
        duration: 5000,
      });

      form.reset({
        url: data.url,
        profileBio: data.profileBio,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      switch (error.code) {
        case AppErrorCode.ALREADY_EXISTS:
        case 'PREMIUM_PROFILE_URL':
        case 'PROFILE_URL_TAKEN':
          form.setError('url', {
            type: 'manual',
            message: error.message,
          });

          break;

        default:
          toast({
            title: _(msg`An unknown error occurred`),
            description: _(
              msg`We encountered an unknown error while attempting to update your public profile. Please try again later.`,
            ),
            variant: 'destructive',
          });
      }
    }
  };

  const onCopy = async () => {
    await copy(formatUserProfilePath(form.getValues('url') ?? '')).then(() => {
      toast({
        title: _(msg`Copied to clipboard`),
        description: _(msg`The profile link has been copied to your clipboard`),
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
      <form className={cn('flex w-full flex-col gap-y-4', className)} onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset className="flex w-full min-w-0 flex-col gap-y-4" disabled={isSubmitting}>
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Public profile URL</Trans>
                </FormLabel>
                <div
                  className={cn(
                    'flex h-10 w-full items-center overflow-hidden rounded-md border border-input bg-background pr-1.5 text-base ring-offset-background has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 md:text-sm',
                    form.formState.errors.url && 'ring-2 ring-destructive',
                  )}
                >
                  <span className="flex h-full select-none items-center whitespace-nowrap border-input border-r bg-muted/50 pr-2.5 pl-3 text-muted-foreground">
                    {formatUserProfilePath('').replace(/https?:\/\//, '')}
                  </span>

                  <FormControl>
                    <input
                      {...field}
                      className="h-full min-w-0 flex-1 bg-transparent px-2.5 placeholder:text-muted-foreground/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={field.disabled || !isPersonalLayoutMode}
                    />
                  </FormControl>

                  {field.value && (
                    <Button
                      type="button"
                      variant="none"
                      aria-label={_(msg`Copy profile URL`)}
                      className="h-7 w-7 shrink-0 rounded p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={async () => onCopy()}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={copiedTimeout ? 'copied' : 'copy'}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        >
                          {copiedTimeout ? (
                            <CheckIcon className="h-4 w-4 shrink-0" />
                          ) : (
                            <CopyIcon className="h-4 w-4 shrink-0" />
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </Button>
                  )}
                </div>

                {!isPersonalLayoutMode ? (
                  <p className="text-muted-foreground text-xs">
                    <Trans>You can update the profile URL by updating the team URL in the general settings page.</Trans>
                  </p>
                ) : (
                  !form.formState.errors.url && (
                    <p className="text-muted-foreground text-xs">
                      <Trans>A unique URL to access your profile</Trans>
                    </p>
                  )
                )}

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="profileBio"
            render={({ field }) => {
              const remaningLength = MAX_PROFILE_BIO_LENGTH - (field.value || '').length;

              return (
                <FormItem>
                  <FormLabel>
                    <Trans>Bio</Trans>
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={_(msg`Write a description to display on your public profile`)} />
                  </FormControl>

                  {!form.formState.errors.profileBio && (
                    <p className="text-muted-foreground text-sm">
                      {remaningLength >= 0 ? (
                        <Plural
                          value={remaningLength}
                          one={<Trans># character remaining</Trans>}
                          other={<Trans># characters remaining</Trans>}
                        />
                      ) : (
                        <Plural
                          value={Math.abs(remaningLength)}
                          one={<Trans># character over the limit</Trans>}
                          other={<Trans># characters over the limit</Trans>}
                        />
                      )}
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
                    <Trans>Reset</Trans>
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
              <Trans>Update</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
