'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import type { z } from 'zod';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { DocumentVisibility } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { ZUpdateTeamMutationSchema } from '@documenso/trpc/server/team-router/schema';
import {
  DocumentVisibilitySelect,
  DocumentVisibilityTooltip,
} from '@documenso/ui/components/document/document-visibility-select';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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

export type UpdateTeamDialogProps = {
  teamId: number;
  teamName: string;
  teamUrl: string;
  documentVisibility?: DocumentVisibility;
  includeSenderDetails?: boolean;
};

const ZUpdateTeamFormSchema = ZUpdateTeamMutationSchema.shape.data.pick({
  name: true,
  url: true,
  documentVisibility: true,
  includeSenderDetails: true,
});

type TUpdateTeamFormSchema = z.infer<typeof ZUpdateTeamFormSchema>;

export const UpdateTeamForm = ({
  teamId,
  teamName,
  teamUrl,
  documentVisibility,
  includeSenderDetails,
}: UpdateTeamDialogProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const email = session?.user?.email;
  const { _ } = useLingui();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(ZUpdateTeamFormSchema),
    defaultValues: {
      name: teamName,
      url: teamUrl,
      documentVisibility,
      includeSenderDetails,
    },
  });

  const { mutateAsync: updateTeam } = trpc.team.updateTeam.useMutation();
  const includeSenderDetailsCheck = form.watch('includeSenderDetails');

  const mapVisibilityToRole = (visibility: DocumentVisibility): DocumentVisibility =>
    match(visibility)
      .with(DocumentVisibility.ADMIN, () => DocumentVisibility.ADMIN)
      .with(DocumentVisibility.MANAGER_AND_ABOVE, () => DocumentVisibility.MANAGER_AND_ABOVE)
      .otherwise(() => DocumentVisibility.EVERYONE);

  const currentVisibilityRole = mapVisibilityToRole(
    documentVisibility ?? DocumentVisibility.EVERYONE,
  );
  const onFormSubmit = async ({
    name,
    url,
    documentVisibility,
    includeSenderDetails,
  }: TUpdateTeamFormSchema) => {
    try {
      await updateTeam({
        data: {
          name,
          url,
          documentVisibility,
          includeSenderDetails,
        },
        teamId,
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`Your team has been successfully updated.`),
        duration: 5000,
      });

      form.reset({
        name,
        url,
        documentVisibility,
        includeSenderDetails,
      });

      if (url !== teamUrl) {
        router.push(`${WEBAPP_BASE_URL}/t/${url}/settings`);
      }
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        form.setError('url', {
          type: 'manual',
          message: _(msg`This URL is already in use.`),
        });

        return;
      }

      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to update your team. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset className="flex h-full flex-col" disabled={form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  <Trans>Team Name</Trans>
                </FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel required>
                  <Trans>Team URL</Trans>
                </FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
                </FormControl>
                {!form.formState.errors.url && (
                  <span className="text-foreground/50 text-xs font-normal">
                    {field.value ? (
                      `${WEBAPP_BASE_URL}/t/${field.value}`
                    ) : (
                      <Trans>A unique URL to identify your team</Trans>
                    )}
                  </span>
                )}

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentVisibility"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mt-4 flex flex-row items-center">
                  <Trans>Default Document Visibility</Trans>
                  <DocumentVisibilityTooltip />
                </FormLabel>
                <FormControl>
                  <DocumentVisibilitySelect
                    currentMemberRole={currentVisibilityRole}
                    isTeamSettings={true}
                    {...field}
                    onValueChange={field.onChange}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <div className="mb-4">
            <FormField
              control={form.control}
              name="includeSenderDetails"
              render={({ field }) => (
                <FormItem>
                  <div className="mt-6 flex flex-row items-center gap-4">
                    <FormLabel>
                      <Trans>Send on Behalf of Team</Trans>
                    </FormLabel>
                    <FormControl>
                      <Checkbox
                        className="h-5 w-5"
                        checkClassName="text-white"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>

                  {includeSenderDetailsCheck ? (
                    <blockquote className="text-foreground/50 text-xs italic">
                      <Trans>
                        "{email}" on behalf of "{teamName}" has invited you to sign "example
                        document".
                      </Trans>
                    </blockquote>
                  ) : (
                    <blockquote className="text-foreground/50 text-xs italic">
                      <Trans>"{teamUrl}" has invited you to sign "example document".</Trans>
                    </blockquote>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
              <Trans>Update team</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
