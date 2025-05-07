import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationRequestSchema } from '@documenso/trpc/server/organisation-router/create-organisation.types';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export type OrganisationCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateOrganisationFormSchema = ZCreateOrganisationRequestSchema.pick({
  name: true,
  url: true,
});

type TCreateOrganisationFormSchema = z.infer<typeof ZCreateOrganisationFormSchema>;

export const OrganisationCreateDialog = ({ trigger, ...props }: OrganisationCreateDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(ZCreateOrganisationFormSchema),
    defaultValues: {
      name: '',
      url: '',
    },
  });

  const { mutateAsync: createOrganisation } = trpc.organisation.create.useMutation();

  const onFormSubmit = async ({ name, url }: TCreateOrganisationFormSchema) => {
    try {
      const response = await createOrganisation({
        name,
        url,
      });

      setOpen(false);

      // if (response.paymentRequired) {
      //   await navigate(`/settings/teams?tab=pending&checkout=${response.pendingTeamId}`);
      //   return;
      // }

      toast({
        title: _(msg`Success`),
        description: _(msg`Your organisation has been created.`),
        duration: 5000,
      });
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
          msg`We encountered an unknown error while attempting to create a organisation. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  const mapTextToUrl = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-');
  };

  useEffect(() => {
    form.reset();
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Create organisation</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create organisation</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Create an organisation to collaborate with teams</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Organisation Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="bg-background"
                        {...field}
                        onChange={(event) => {
                          const oldGeneratedUrl = mapTextToUrl(field.value);
                          const newGeneratedUrl = mapTextToUrl(event.target.value);

                          const urlField = form.getValues('url');
                          if (urlField === oldGeneratedUrl) {
                            form.setValue('url', newGeneratedUrl);
                          }

                          field.onChange(event);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
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

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button
                  type="submit"
                  data-testid="dialog-create-organisation-button"
                  loading={form.formState.isSubmitting}
                >
                  <Trans>Create Organisation</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
