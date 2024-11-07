'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { InfoIcon, Plus } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX,
  TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX,
} from '@documenso/lib/constants/template';
import { AppError } from '@documenso/lib/errors/app-error';
import type { Recipient } from '@documenso/prisma/client';
import { DocumentSigningOrder } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogClose,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import type { Toast } from '@documenso/ui/primitives/use-toast';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

const ZAddRecipientsForNewDocumentSchema = z
  .object({
    sendDocument: z.boolean(),
    recipients: z.array(
      z.object({
        id: z.number(),
        email: z.string().email(),
        name: z.string(),
        signingOrder: z.number().optional(),
      }),
    ),
  })
  // Display exactly which rows are duplicates.
  .superRefine((items, ctx) => {
    const uniqueEmails = new Map<string, number>();

    for (const [index, recipients] of items.recipients.entries()) {
      const email = recipients.email.toLowerCase();

      const firstFoundIndex = uniqueEmails.get(email);

      if (firstFoundIndex === undefined) {
        uniqueEmails.set(email, index);
        continue;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Emails must be unique',
        path: ['recipients', index, 'email'],
      });

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Emails must be unique',
        path: ['recipients', firstFoundIndex, 'email'],
      });
    }
  });

type TAddRecipientsForNewDocumentSchema = z.infer<typeof ZAddRecipientsForNewDocumentSchema>;

export type UseTemplateDialogProps = {
  templateId: number;
  templateSigningOrder?: DocumentSigningOrder | null;
  recipients: Recipient[];
  documentRootPath: string;
  trigger?: React.ReactNode;
};

export function UseTemplateDialog({
  recipients,
  documentRootPath,
  templateId,
  templateSigningOrder,
  trigger,
}: UseTemplateDialogProps) {
  const router = useRouter();

  const { toast } = useToast();
  const { _ } = useLingui();

  const [open, setOpen] = useState(false);

  const team = useOptionalCurrentTeam();

  const form = useForm<TAddRecipientsForNewDocumentSchema>({
    resolver: zodResolver(ZAddRecipientsForNewDocumentSchema),
    defaultValues: {
      sendDocument: false,
      recipients: recipients
        .sort((a, b) => (a.signingOrder || 0) - (b.signingOrder || 0))
        .map((recipient) => {
          const isRecipientEmailPlaceholder = recipient.email.match(
            TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX,
          );

          const isRecipientNamePlaceholder = recipient.name.match(
            TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX,
          );

          return {
            id: recipient.id,
            name: !isRecipientNamePlaceholder ? recipient.name : '',
            email: !isRecipientEmailPlaceholder ? recipient.email : '',
            signingOrder: recipient.signingOrder ?? undefined,
          };
        }),
    },
  });

  const { mutateAsync: createDocumentFromTemplate } =
    trpc.template.createDocumentFromTemplate.useMutation();

  const onSubmit = async (data: TAddRecipientsForNewDocumentSchema) => {
    try {
      const { id } = await createDocumentFromTemplate({
        templateId,
        teamId: team?.id,
        recipients: data.recipients,
        sendDocument: data.sendDocument,
      });

      toast({
        title: _(msg`Document created`),
        description: _(msg`Your document has been created from the template successfully.`),
        duration: 5000,
      });

      router.push(`${documentRootPath}/${id}`);
    } catch (err) {
      const error = AppError.parseError(err);

      const toastPayload: Toast = {
        title: _(msg`Error`),
        description: _(msg`An error occurred while creating document from template.`),
        variant: 'destructive',
      };

      if (error.code === 'DOCUMENT_SEND_FAILED') {
        toastPayload.description = _(
          msg`The document was created but could not be sent to recipients.`,
        );
      }

      toast(toastPayload);
    }
  };

  const { fields: formRecipients } = useFieldArray({
    control: form.control,
    name: 'recipients',
  });

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="bg-background">
            <Plus className="-ml-1 mr-2 h-4 w-4" />
            <Trans>Use Template</Trans>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create document from template</Trans>
          </DialogTitle>
          <DialogDescription>
            {recipients.length === 0 ? (
              <Trans>A draft document will be created</Trans>
            ) : (
              <Trans>Add the recipients to create the document with</Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset className="flex h-full flex-col" disabled={form.formState.isSubmitting}>
              <div className="custom-scrollbar -m-1 max-h-[60vh] space-y-4 overflow-y-auto p-1">
                {formRecipients.map((recipient, index) => (
                  <div className="flex w-full flex-row space-x-4" key={recipient.id}>
                    {templateSigningOrder === DocumentSigningOrder.SEQUENTIAL && (
                      <FormField
                        control={form.control}
                        name={`recipients.${index}.signingOrder`}
                        render={({ field }) => (
                          <FormItem
                            className={cn('w-20', {
                              'mt-8': index === 0,
                            })}
                          >
                            <FormControl>
                              <Input
                                {...field}
                                disabled
                                className="items-center justify-center"
                                value={
                                  field.value?.toString() ||
                                  recipients[index]?.signingOrder?.toString()
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name={`recipients.${index}.email`}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          {index === 0 && (
                            <FormLabel required>
                              <Trans>Email</Trans>
                            </FormLabel>
                          )}

                          <FormControl>
                            <Input
                              {...field}
                              placeholder={recipients[index].email || _(msg`Email`)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`recipients.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          {index === 0 && (
                            <FormLabel>
                              <Trans>Name</Trans>
                            </FormLabel>
                          )}

                          <FormControl>
                            <Input
                              {...field}
                              placeholder={recipients[index].name || _(msg`Name`)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>

              {recipients.length > 0 && (
                <div className="mt-4 flex flex-row items-center">
                  <FormField
                    control={form.control}
                    name="sendDocument"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-row items-center">
                          <Checkbox
                            id="sendDocument"
                            className="h-5 w-5"
                            checkClassName="dark:text-white text-primary"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />

                          <label
                            className="text-muted-foreground ml-2 flex items-center text-sm"
                            htmlFor="sendDocument"
                          >
                            <Trans>Send document</Trans>
                            <Tooltip>
                              <TooltipTrigger type="button">
                                <InfoIcon className="mx-1 h-4 w-4" />
                              </TooltipTrigger>

                              <TooltipContent className="text-muted-foreground z-[99999] max-w-md space-y-2 p-4">
                                <p>
                                  <Trans>
                                    {' '}
                                    The document will be immediately sent to recipients if this is
                                    checked.
                                  </Trans>
                                </p>

                                <p>
                                  <Trans>Otherwise, the document will be created as a draft.</Trans>
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </label>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    <Trans>Close</Trans>
                  </Button>
                </DialogClose>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  {form.getValues('sendDocument') ? (
                    <Trans>Create and send</Trans>
                  ) : (
                    <Trans>Create as draft</Trans>
                  )}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
