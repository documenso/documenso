import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationEmailRequestSchema } from '@documenso/trpc/server/enterprise-router/create-organisation-email.types';
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

type EmailDomain = {
  id: string;
  domain: string;
  status: string;
};

export type OrganisationEmailCreateDialogProps = {
  trigger?: React.ReactNode;
  emailDomain: EmailDomain;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateOrganisationEmailFormSchema = ZCreateOrganisationEmailRequestSchema.pick({
  emailName: true,
  email: true,
  // replyTo: true,
});

type TCreateOrganisationEmailFormSchema = z.infer<typeof ZCreateOrganisationEmailFormSchema>;

export const OrganisationEmailCreateDialog = ({
  trigger,
  emailDomain,
  ...props
}: OrganisationEmailCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(ZCreateOrganisationEmailFormSchema),
    defaultValues: {
      emailName: '',
      email: '',
      // replyTo: '',
    },
  });

  const { mutateAsync: createOrganisationEmail, isPending } =
    trpc.enterprise.organisation.email.create.useMutation();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onFormSubmit = async (data: TCreateOrganisationEmailFormSchema) => {
    try {
      await createOrganisationEmail({
        emailDomainId: emailDomain.id,
        ...data,
      });

      toast({
        title: t`Email Created`,
        description: t`The organisation email has been created successfully.`,
      });

      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        toast({
          title: t`Email already exists`,
          description: t`An email with this address already exists.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t`An error occurred`,
          description: t`We encountered an error while creating the email. Please try again later.`,
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog {...props} open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Add Email</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <Trans>Add Organisation Email</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Create a new email address for your organisation using the domain{' '}
              <span className="font-bold">{emailDomain.domain}</span>.
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

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Email Address</Trans>
                    </FormLabel>
                    <FormControl>
                      <div className="relative flex items-center gap-2">
                        <Input
                          {...field}
                          value={field.value.split('@')[0]}
                          onChange={(e) => {
                            field.onChange(e.target.value + '@' + emailDomain.domain);
                          }}
                          placeholder={t`support`}
                        />
                        <div className="bg-muted text-muted-foreground absolute bottom-0 right-0 top-0 flex items-center rounded-r-md border px-3 py-2 text-sm">
                          @{emailDomain.domain}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                    {!form.formState.errors.email && (
                      <span className="text-foreground/50 text-xs font-normal">
                        {field.value ? (
                          field.value
                        ) : (
                          <Trans>
                            The part before the @ symbol (e.g., "support" for support@
                            {emailDomain.domain})
                          </Trans>
                        )}
                      </span>
                    )}
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

                <Button
                  type="submit"
                  data-testid="dialog-create-organisation-email-button"
                  loading={isPending}
                >
                  <Trans>Create Email</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
