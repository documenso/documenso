import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon, Plus } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';

import { TEMPLATE_RECIPIENT_PLACEHOLDER_REGEX } from '@documenso/lib/constants/template';
import { AppError } from '@documenso/lib/errors/app-error';
import type { Recipient } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
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
  recipients: Recipient[];
  documentRootPath: string;
};

export function UseTemplateDialog({
  recipients,
  documentRootPath,
  templateId,
}: UseTemplateDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const team = useOptionalCurrentTeam();

  const form = useForm<TAddRecipientsForNewDocumentSchema>({
    resolver: zodResolver(ZAddRecipientsForNewDocumentSchema),
    defaultValues: {
      sendDocument: false,
      recipients: recipients.map((recipient) => {
        const isRecipientPlaceholder = recipient.email.match(TEMPLATE_RECIPIENT_PLACEHOLDER_REGEX);

        if (isRecipientPlaceholder) {
          return {
            id: recipient.id,
            name: '',
            email: '',
          };
        }

        return {
          id: recipient.id,
          name: recipient.name,
          email: recipient.email,
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
        title: 'Document created',
        description: 'Your document has been created from the template successfully.',
        duration: 5000,
      });

      router.push(`${documentRootPath}/${id}`);
    } catch (err) {
      const error = AppError.parseError(err);

      const toastPayload: Toast = {
        title: 'Error',
        description: 'An error occurred while creating document from template.',
        variant: 'destructive',
      };

      if (error.code === 'DOCUMENT_SEND_FAILED') {
        toastPayload.description = 'The document was created but could not be sent to recipients.';
      }

      toast(toastPayload);
    }
  };

  const { fields: formRecipients } = useFieldArray({
    control: form.control,
    name: 'recipients',
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="-ml-1 mr-2 h-4 w-4" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create document from template</DialogTitle>
          <DialogDescription>
            {recipients.length === 0
              ? 'A draft document will be created'
              : 'Add the recipients to create the document with'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset className="flex h-full flex-col" disabled={form.formState.isSubmitting}>
              <div className="custom-scrollbar -m-1 max-h-[60vh] space-y-4 overflow-y-auto p-1">
                {formRecipients.map((recipient, index) => (
                  <div className="flex w-full flex-row space-x-4" key={recipient.id}>
                    <FormField
                      control={form.control}
                      name={`recipients.${index}.email`}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          {index === 0 && <FormLabel required>Email</FormLabel>}

                          <FormControl>
                            <Input {...field} placeholder={recipients[index].email} />
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
                          {index === 0 && <FormLabel>Name</FormLabel>}

                          <FormControl>
                            <Input {...field} placeholder={recipients[index].name} />
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
                            Send document
                            <Tooltip>
                              <TooltipTrigger type="button">
                                <InfoIcon className="mx-1 h-4 w-4" />
                              </TooltipTrigger>

                              <TooltipContent className="text-muted-foreground z-[99999] max-w-md space-y-2 p-4">
                                <p>
                                  The document will be immediately sent to recipients if this is
                                  checked.
                                </p>

                                <p>Otherwise, the document will be created as a draft.</p>
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
                    Close
                  </Button>
                </DialogClose>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  {form.getValues('sendDocument') ? 'Create and send' : 'Create as draft'}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
