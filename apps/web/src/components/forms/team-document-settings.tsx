'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import type { z } from 'zod';

import { DocumentVisibility } from '@documenso/prisma/client';
import type { Team, TeamGlobalSettings } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { ZUpdateTeamDocumentGlobalSettingsMutationSchema } from '@documenso/trpc/server/team-router/schema';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZUpdateTeamGlobalSettings = ZUpdateTeamDocumentGlobalSettingsMutationSchema.pick({
  documentVisibility: true,
  includeSenderDetails: true,
});

type TUpdateTeamGlobalSettings = z.infer<typeof ZUpdateTeamGlobalSettings>;

export type TeamDocumentSettingsProps = {
  team: Team & { teamGlobalSettings: TeamGlobalSettings | null };
};

export const TeamDocumentSettings = ({ team }: TeamDocumentSettingsProps) => {
  const { data: session } = useSession();
  const email = session?.user?.email;

  const { toast } = useToast();
  const router = useRouter();
  const { _ } = useLingui();

  const { mutateAsync: updateTeamDocumentGlobalSettings } =
    trpc.team.updateTeamDocumentGlobalSettings.useMutation();

  const form = useForm<TUpdateTeamGlobalSettings>({
    values: {
      documentVisibility: team?.teamGlobalSettings?.documentVisibility,
      includeSenderDetails: team?.teamGlobalSettings?.includeSenderDetails,
    },
    resolver: zodResolver(ZUpdateTeamGlobalSettings),
  });

  const isSubmitting = form.formState.isSubmitting;
  const includeSenderDetails = form.watch('includeSenderDetails');

  const onFormSubmit = async (data: TUpdateTeamGlobalSettings) => {
    try {
      await updateTeamDocumentGlobalSettings({
        ...data,
        teamId: team.id,
      });

      toast({
        title: _(msg`Global Team Settings Updated`),
        description: _(msg`Your global team document settings have been updated successfully.`),
        duration: 5000,
      });

      router.refresh();
    } catch (e) {
      toast({
        title: _(msg`Error updating global team settings`),
        description: _(msg`An error occurred while updating the global team settings.`),
        variant: 'destructive',
      });
    }
  };

  const mapVisibilityToRole = (visibility: DocumentVisibility): DocumentVisibility =>
    match(visibility)
      .with(DocumentVisibility.ADMIN, () => DocumentVisibility.ADMIN)
      .with(DocumentVisibility.MANAGER_AND_ABOVE, () => DocumentVisibility.MANAGER_AND_ABOVE)
      .otherwise(() => DocumentVisibility.EVERYONE);

  const currentVisibilityRole = mapVisibilityToRole(
    team?.teamGlobalSettings?.documentVisibility ?? DocumentVisibility.EVERYONE,
  );

  return (
    <div>
      <Form {...form}>
        <form
          className="mt-6 flex w-full flex-col gap-y-4"
          onSubmit={form.handleSubmit(onFormSubmit)}
        >
          <fieldset>
            <FormField
              control={form.control}
              name="documentVisibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex flex-row items-center">
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

                    {includeSenderDetails ? (
                      <blockquote className="text-foreground/50 text-xs italic">
                        <Trans>
                          "{email}" on behalf of "{team.name}" has invited you to sign "example
                          document".
                        </Trans>
                      </blockquote>
                    ) : (
                      <blockquote className="text-foreground/50 text-xs italic">
                        <Trans>"{team.name}" has invited you to sign "example document".</Trans>
                      </blockquote>
                    )}

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </fieldset>

          <Button type="submit" loading={isSubmitting} className="self-end">
            {isSubmitting ? <Trans>Updating profile...</Trans> : <Trans>Update profile</Trans>}
          </Button>
        </form>
      </Form>
    </div>
  );
};
