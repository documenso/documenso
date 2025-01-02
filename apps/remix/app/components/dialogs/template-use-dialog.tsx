import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Recipient } from '@prisma/client';
import { DocumentDistributionMethod, DocumentSigningOrder } from '@prisma/client';
import { InfoIcon, Plus, Upload, X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import * as z from 'zod';

import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import {
  TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX,
  TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX,
} from '@documenso/lib/constants/template';
import { AppError } from '@documenso/lib/errors/app-error';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
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

const ZAddRecipientsForNewDocumentSchema = z
  .object({
    distributeDocument: z.boolean(),
    useCustomDocument: z.boolean().default(false),
    customDocumentData: z
      .any()
      .refine((data) => data instanceof File || data === undefined)
      .optional(),
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

export type TemplateUseDialogProps = {
  templateId: number;
  templateSigningOrder?: DocumentSigningOrder | null;
  recipients: Recipient[];
  documentDistributionMethod?: DocumentDistributionMethod;
  documentRootPath: string;
  trigger?: React.ReactNode;
};

export function TemplateUseDialog({
  recipients,
  documentDistributionMethod = DocumentDistributionMethod.EMAIL,
  documentRootPath,
  templateId,
  templateSigningOrder,
  trigger,
}: TemplateUseDialogProps) {
  const { toast } = useToast();
  const { _ } = useLingui();

  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const form = useForm<TAddRecipientsForNewDocumentSchema>({
    resolver: zodResolver(ZAddRecipientsForNewDocumentSchema),
    defaultValues: {
      distributeDocument: false,
      useCustomDocument: false,
      customDocumentData: undefined,
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
      let customDocumentDataId: string | undefined = undefined;

      if (data.useCustomDocument && data.customDocumentData) {
        const customDocumentData = await putPdfFile(data.customDocumentData);
        customDocumentDataId = customDocumentData.id;
      }

      const { id } = await createDocumentFromTemplate({
        templateId,
        recipients: data.recipients,
        distributeDocument: data.distributeDocument,
        customDocumentDataId,
      });

      toast({
        title: _(msg`Document created`),
        description: _(msg`Your document has been created from the template successfully.`),
        duration: 5000,
      });

      let documentPath = `${documentRootPath}/${id}`;

      if (
        data.distributeDocument &&
        documentDistributionMethod === DocumentDistributionMethod.NONE
      ) {
        documentPath += '?action=view-signing-links';
      }

      await navigate(documentPath);
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

                {recipients.length > 0 && (
                  <div className="mt-4 flex flex-row items-center">
                    <FormField
                      control={form.control}
                      name="distributeDocument"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex flex-row items-center">
                            <Checkbox
                              id="distributeDocument"
                              className="h-5 w-5"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />

                            {documentDistributionMethod === DocumentDistributionMethod.EMAIL && (
                              <label
                                className="text-muted-foreground ml-2 flex items-center text-sm"
                                htmlFor="distributeDocument"
                              >
                                <Trans>Send document</Trans>
                                <Tooltip>
                                  <TooltipTrigger type="button">
                                    <InfoIcon className="mx-1 h-4 w-4" />
                                  </TooltipTrigger>

                                  <TooltipContent className="text-muted-foreground z-[99999] max-w-md space-y-2 p-4">
                                    <p>
                                      <Trans>
                                        The document will be immediately sent to recipients if this
                                        is checked.
                                      </Trans>
                                    </p>

                                    <p>
                                      <Trans>
                                        Otherwise, the document will be created as a draft.
                                      </Trans>
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </label>
                            )}

                            {documentDistributionMethod === DocumentDistributionMethod.NONE && (
                              <label
                                className="text-muted-foreground ml-2 flex items-center text-sm"
                                htmlFor="distributeDocument"
                              >
                                <Trans>Create as pending</Trans>
                                <Tooltip>
                                  <TooltipTrigger type="button">
                                    <InfoIcon className="mx-1 h-4 w-4" />
                                  </TooltipTrigger>
                                  <TooltipContent className="text-muted-foreground z-[99999] max-w-md space-y-2 p-4">
                                    <p>
                                      <Trans>
                                        Create the document as pending and ready to sign.
                                      </Trans>
                                    </p>

                                    <p>
                                      <Trans>We won't send anything to notify recipients.</Trans>
                                    </p>

                                    <p className="mt-2">
                                      <Trans>
                                        We will generate signing links for you, which you can send
                                        to the recipients through your method of choice.
                                      </Trans>
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </label>
                            )}
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="useCustomDocument"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-row items-center">
                        <Checkbox
                          id="useCustomDocument"
                          className="h-5 w-5"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue('customDocumentData', undefined);
                            }
                          }}
                        />
                        <label
                          className="text-muted-foreground ml-2 flex items-center text-sm"
                          htmlFor="useCustomDocument"
                        >
                          <Trans>Upload custom document</Trans>
                          <Tooltip>
                            <TooltipTrigger type="button">
                              <InfoIcon className="mx-1 h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent className="text-muted-foreground z-[99999] max-w-md space-y-2 p-4">
                              <p>
                                <Trans>
                                  Upload a custom document to use instead of the template's default
                                  document
                                </Trans>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </label>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch('useCustomDocument') && (
                  <div className="my-4">
                    <FormField
                      control={form.control}
                      name="customDocumentData"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="w-full space-y-4">
                              <label
                                className={cn(
                                  'text-muted-foreground hover:border-muted-foreground/50 group relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-6 py-10 transition-colors',
                                  {
                                    'border-destructive hover:border-destructive':
                                      form.formState.errors.customDocumentData,
                                  },
                                )}
                              >
                                <div className="text-center">
                                  {!field.value && (
                                    <>
                                      <Upload className="text-muted-foreground/50 mx-auto h-10 w-10" />
                                      <div className="mt-4 flex text-sm leading-6">
                                        <span className="text-muted-foreground relative">
                                          <Trans>
                                            <span className="text-primary font-semibold">
                                              Click to upload
                                            </span>{' '}
                                            or drag and drop
                                          </Trans>
                                        </span>
                                      </div>
                                      <p className="text-muted-foreground/80 text-xs">
                                        PDF files only
                                      </p>
                                    </>
                                  )}

                                  {field.value && (
                                    <div className="text-muted-foreground space-y-1">
                                      <p className="text-sm font-medium">{field.value.name}</p>
                                      <p className="text-muted-foreground/60 text-xs">
                                        {(field.value.size / (1024 * 1024)).toFixed(2)} MB
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <input
                                  type="file"
                                  className="absolute h-full w-full opacity-0"
                                  accept=".pdf,application/pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];

                                    if (!file) {
                                      field.onChange(undefined);

                                      return;
                                    }

                                    if (file.type !== 'application/pdf') {
                                      form.setError('customDocumentData', {
                                        type: 'manual',
                                        message: _(msg`Please select a PDF file`),
                                      });

                                      return;
                                    }

                                    if (file.size > APP_DOCUMENT_UPLOAD_SIZE_LIMIT * 1024 * 1024) {
                                      form.setError('customDocumentData', {
                                        type: 'manual',
                                        message: _(
                                          msg`File size exceeds the limit of ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT} MB`,
                                        ),
                                      });

                                      return;
                                    }

                                    field.onChange(file);
                                  }}
                                />

                                {field.value && (
                                  <div className="absolute right-2 top-2">
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        field.onChange(undefined);
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                      <div className="sr-only">
                                        <Trans>Clear file</Trans>
                                      </div>
                                    </Button>
                                  </div>
                                )}
                              </label>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    <Trans>Close</Trans>
                  </Button>
                </DialogClose>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  {!form.getValues('distributeDocument') ? (
                    <Trans>Create as draft</Trans>
                  ) : documentDistributionMethod === DocumentDistributionMethod.EMAIL ? (
                    <Trans>Create and send</Trans>
                  ) : (
                    <Trans>Create signing links</Trans>
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
