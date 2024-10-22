'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/macro';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { DOCUMENT_VISIBILITY } from '@documenso/lib/constants/document-visibility';
import type { Team } from '@documenso/prisma/client';
import { ZUpdateTeamGlobalSettingsMutationSchema } from '@documenso/trpc/server/team-router/schema';
import { DocumentVisibilitySelect } from '@documenso/ui/components/document/document-visibility-select';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';

const ZUpdateTeamGlobalSettings = ZUpdateTeamGlobalSettingsMutationSchema.pick({
  documentVisibility: true,
  includeSenderDetails: true,
});

type TUpdateTeamGlobalSettings = z.infer<typeof ZUpdateTeamGlobalSettings>;

export type TeamDocumentSettingsProps = {
  team: Team;
};

export const TeamDocumentSettings = ({ team }: TeamDocumentSettingsProps) => {
  console.log('inside TeamDocumentSettings', { team });

  const form = useForm<TUpdateTeamGlobalSettings>({
    values: {
      documentVisibility: team.teamGlobalSettings.documentVisibility ?? '',
      includeSenderDetails: team.teamGlobalSettings.includeSenderDetails ?? '',
    },
    resolver: zodResolver(ZUpdateTeamGlobalSettings),
  });

  const onFormSubmit = (data: TUpdateTeamGlobalSettings) => {
    console.log({ data });
  };

  const d = DOCUMENT_VISIBILITY[form.getValues('documentVisibility')].value;
  console.log({ d });

  return (
    <div>
      <Form {...form}>
        <form className="mt-6 flex flex-col gap-y-4" onSubmit={form.handleSubmit(onFormSubmit)}>
          <fieldset className="flex w-full flex-col gap-y-4">
            <FormField
              control={form.control}
              name="documentVisibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Document Visibility</Trans>
                  </FormLabel>
                  <FormControl>
                    <DocumentVisibilitySelect
                      currentMemberRole={d}
                      {...field}
                      onValueChange={field.onChange}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="includeSenderDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Include Sender Details</Trans>
                  </FormLabel>
                  <FormControl>
                    <Checkbox />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
        </form>
      </Form>
    </div>
  );
};
