import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZUpdateOrganisationRequestSchema } from '@documenso/trpc/server/organisation-router/update-organisation.types';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZOrganisationUpdateFormSchema = ZUpdateOrganisationRequestSchema.shape.data.pick({
  name: true,
  url: true,
});

type TOrganisationUpdateFormSchema = z.infer<typeof ZOrganisationUpdateFormSchema>;

export const OrganisationUpdateForm = () => {
  const navigate = useNavigate();
  const organisation = useCurrentOrganisation();

  const { _ } = useLingui();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(ZOrganisationUpdateFormSchema),
    defaultValues: {
      name: organisation.name,
      url: organisation.url,
    },
  });

  const { mutateAsync: updateOrganisation } = trpc.organisation.update.useMutation();

  const onFormSubmit = async ({ name, url }: TOrganisationUpdateFormSchema) => {
    try {
      await updateOrganisation({
        data: {
          name,
          url,
        },
        organisationId: organisation.id,
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`Your organisation has been successfully updated.`),
        duration: 5000,
      });

      form.reset({
        name,
        url,
      });

      if (url !== organisation.url) {
        await navigate(`/org/${url}/settings`);
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
          msg`We encountered an unknown error while attempting to update your organisation. Please try again later.`,
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
                  <Trans>Organisation Name</Trans>
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
                  <Trans>Organisation URL</Trans>
                </FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
                </FormControl>
                {!form.formState.errors.url && (
                  <span className="text-foreground/50 text-xs font-normal">
                    {field.value ? (
                      `${NEXT_PUBLIC_WEBAPP_URL()}/org/${field.value}`
                    ) : (
                      <Trans>A unique URL to identify your organisation</Trans>
                    )}
                  </span>
                )}

                <FormMessage />
              </FormItem>
            )}
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
              <Trans>Update organisation</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
