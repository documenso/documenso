import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Recipient } from '@prisma/client';
import { DocumentDistributionMethod, DocumentSigningOrder } from '@prisma/client';
import { FileTextIcon, InfoIcon, Plus, UploadCloudIcon, X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import * as z from 'zod';

import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import {
  TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX,
  TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX,
} from '@documenso/lib/constants/template';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
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
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import type { Toast } from '@documenso/ui/primitives/use-toast';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZAddRecipientsForNewDocumentSchema = z.object({
  distributeDocument: z.boolean(),
  useCustomDocument: z.boolean().default(false),
  customDocumentData: z
    .array(
      z.object({
        title: z.string(),
        data: z.instanceof(File).optional(),
        envelopeItemId: z.string(),
      }),
    )
    .optional(),
  recipients: z.array(
    z.object({
      id: z.number(),
      email: z.string().email(),
      name: z.string(),
      signingOrder: z.number().optional(),
    }),
  ),
});

type TAddRecipientsForNewDocumentSchema = z.infer<typeof ZAddRecipientsForNewDocumentSchema>;

export type TemplateUseDialogProps = {
  envelopeId: string;
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
  envelopeId,
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
      customDocumentData: [],
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

  const { replace, fields: localCustomDocumentData } = useFieldArray({
    control: form.control,
    name: 'customDocumentData',
  });

  const { data: response, isLoading: isLoadingEnvelopeItems } = trpc.envelope.item.getMany.useQuery(
    {
      envelopeId,
    },
    {
      placeholderData: (previousData) => previousData,
      ...SKIP_QUERY_BATCH_META,
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    },
  );

  const envelopeItems = response?.data ?? [];

  const { mutateAsync: createDocumentFromTemplate } =
    trpc.template.createDocumentFromTemplate.useMutation();

  const onSubmit = async (data: TAddRecipientsForNewDocumentSchema) => {
    try {
      const customFilesToUpload = (data.customDocumentData || []).filter(
        (item): item is { data: File; envelopeItemId: string; title: string } =>
          item.data !== undefined && item.envelopeItemId !== undefined && item.title !== undefined,
      );

      const customDocumentData = await Promise.all(
        customFilesToUpload.map(async (item) => {
          const customDocumentData = await putPdfFile(item.data);

          return {
            documentDataId: customDocumentData.id,
            envelopeItemId: item.envelopeItemId,
          };
        }),
      );

      const { envelopeId } = await createDocumentFromTemplate({
        templateId,
        recipients: data.recipients,
        distributeDocument: data.distributeDocument,
        customDocumentData,
      });

      toast({
        title: _(msg`Document created`),
        description: _(msg`Your document has been created from the template successfully.`),
        duration: 5000,
      });

      let documentPath = `${documentRootPath}/${envelopeId}`;

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

  useEffect(() => {
    if (envelopeItems.length > 0 && localCustomDocumentData.length === 0) {
      replace(
        envelopeItems.map((item) => ({
          title: item.title,
          data: undefined,
          envelopeItemId: item.id,
        })),
      );
    }
  }, [envelopeItems, form, open]);

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
                            <Input {...field} aria-label="Email" placeholder={_(msg`Email`)} />
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
                              aria-label="Name"
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
                  <div className="my-4 space-y-2">
                    {isLoadingEnvelopeItems ? (
                      <SpinnerBox className="py-16" />
                    ) : (
                      localCustomDocumentData.map((item, i) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name={`customDocumentData.${i}.data`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div
                                  key={item.id}
                                  className="border-border bg-card hover:bg-accent/10 flex items-center gap-4 rounded-lg border p-4 transition-colors"
                                >
                                  <div className="flex-shrink-0">
                                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                                      <FileTextIcon className="text-primary h-5 w-5" />
                                    </div>
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-foreground truncate text-sm font-medium">
                                      {item.title}
                                    </h4>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                      {field.value ? (
                                        <div>
                                          <Trans>
                                            Custom {(field.value.size / (1024 * 1024)).toFixed(2)}{' '}
                                            MB file
                                          </Trans>
                                        </div>
                                      ) : (
                                        <Trans>Default file</Trans>
                                      )}
                                    </p>
                                  </div>

                                  <div className="flex flex-shrink-0 items-center gap-2">
                                    {field.value ? (
                                      <div className="">
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="text-xs"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            field.onChange(undefined);
                                          }}
                                        >
                                          <X className="mr-2 h-4 w-4" />
                                          <Trans>Remove</Trans>
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => {
                                          const fileInput = document.getElementById(
                                            `template-use-dialog-file-input-${item.envelopeItemId}`,
                                          );

                                          if (fileInput instanceof HTMLInputElement) {
                                            fileInput.click();
                                          }
                                        }}
                                      >
                                        <UploadCloudIcon className="mr-2 h-4 w-4" />
                                        <Trans>Upload</Trans>
                                      </Button>
                                    )}

                                    <input
                                      type="file"
                                      id={`template-use-dialog-file-input-${item.envelopeItemId}`}
                                      className="hidden"
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

                                        if (
                                          file.size >
                                          APP_DOCUMENT_UPLOAD_SIZE_LIMIT * 1024 * 1024
                                        ) {
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
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))
                    )}
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
