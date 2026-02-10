import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import type { TGetOrganisationEmailDomainResponse } from '@documenso/trpc/server/enterprise-router/get-organisation-email-domain.types';
import { ZUpdateOrganisationEmailRequestSchema } from '@documenso/trpc/server/enterprise-router/update-organisation-email.types';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type OrganisationEmailUpdateDialogProps = {
  trigger: React.ReactNode;
  organisationEmail: TGetOrganisationEmailDomainResponse['emails'][number];
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZUpdateOrganisationEmailFormSchema = ZUpdateOrganisationEmailRequestSchema.pick({
  emailName: true,
  // replyTo: true,
});

type ZUpdateOrganisationEmailSchema = z.infer<typeof ZUpdateOrganisationEmailFormSchema>;

export const OrganisationEmailUpdateDialog = ({
  trigger,
  organisationEmail,
  ...props
}: OrganisationEmailUpdateDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();

  const form = useForm<ZUpdateOrganisationEmailSchema>({
    resolver: zodResolver(ZUpdateOrganisationEmailFormSchema),
    defaultValues: {
      emailName: organisationEmail.emailName,
      // replyTo: organisationEmail.replyTo ?? undefined,
    },
  });

  const { mutateAsync: updateOrganisationEmail, isPending } =
    trpc.enterprise.organisation.email.update.useMutation();

  const onFormSubmit = async ({ emailName }: ZUpdateOrganisationEmailSchema) => {
    try {
      await updateOrganisationEmail({
        emailId: organisationEmail.id,
        emailName,
        // replyTo,
      });

      toast({
        title: t`Success`,
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: t`An unknown error occurred`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      emailName: organisationEmail.emailName,
      // replyTo: organisationEmail.replyTo ?? undefined,
    });
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Update email</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              You are currently updating{' '}
              <span className="font-bold">{organisationEmail.email}</span>
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset className="flex h-full flex-col space-y-4" disabled={isPending}>
              <FormField
                control={form.control}
                name="emailName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Display Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t`Support`} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      <Trans>The display name for this email address</Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              {/* <FormField
                control={form.control}
                name="replyTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Reply-To Email</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="noreply@example.com" />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      <Trans>
                        Optional no-reply email address attached to emails. Leave blank to default
                        to the organisation settings reply-to email.
                      </Trans>
                    </FormDescription>
                  </FormItem>
                )}
              /> */}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={isPending}>
                  <Trans>Update</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
