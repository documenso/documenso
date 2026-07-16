import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import {
  TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX,
  TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX,
} from '@documenso/lib/constants/template';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION, SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { AppError } from '@documenso/lib/errors/app-error';
import { type TRecipientLite, ZRecipientEmailSchema } from '@documenso/lib/types/recipient';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import { trpc } from '@documenso/trpc/react';
import { DOCUMENT_TITLE_MAX_LENGTH } from '@documenso/trpc/server/document-router/schema';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentDistributionMethod, DocumentSigningOrder } from '@prisma/client';
import { FileTextIcon, InfoIcon, Plus, UploadCloudIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';
import * as z from 'zod';
import { getTemplateUseErrorMessage } from '~/utils/toast-error-messages';

const DOCUMENT_NAME_SOURCE = {
  TEMPLATE: 'template',
  UPLOAD: 'upload',
  CUSTOM: 'custom',
} as const;

type TDocumentNameSource = (typeof DOCUMENT_NAME_SOURCE)[keyof typeof DOCUMENT_NAME_SOURCE];

type TCustomDocumentData = {
  data?: File;
  uploadSequence?: number;
};

const getUploadedDocumentTitle = (file: File) => {
  return file.name.replace(/\.[^/.]+$/, '').trim();
};

const getLastUploadedFile = (customDocumentData?: TCustomDocumentData[]) => {
  const uploadedFiles = customDocumentData?.filter(
    (item): item is Required<TCustomDocumentData> => item.data !== undefined && item.uploadSequence !== undefined,
  );

  if (!uploadedFiles || uploadedFiles.length === 0) {
    return undefined;
  }

  return uploadedFiles.reduce((lastUploadedFile, uploadedFile) =>
    uploadedFile.uploadSequence > lastUploadedFile.uploadSequence ? uploadedFile : lastUploadedFile,
  ).data;
};

const getTemplateUseDocumentTitle = ({
  documentNameSource,
  customDocumentName,
  customDocumentData,
}: {
  documentNameSource: TDocumentNameSource;
  customDocumentName: string;
  customDocumentData?: TCustomDocumentData[];
}) =>
  match(documentNameSource)
    .with(DOCUMENT_NAME_SOURCE.UPLOAD, () => {
      const uploadedFile = getLastUploadedFile(customDocumentData);

      return uploadedFile ? getUploadedDocumentTitle(uploadedFile) : undefined;
    })
    .with(DOCUMENT_NAME_SOURCE.CUSTOM, () => customDocumentName.trim())
    .with(DOCUMENT_NAME_SOURCE.TEMPLATE, () => undefined)
    .exhaustive();

const ZAddRecipientsForNewDocumentSchema = z
  .object({
    distributeDocument: z.boolean(),
    useCustomDocument: z.boolean().default(false),
    documentNameSource: z.enum([
      DOCUMENT_NAME_SOURCE.TEMPLATE,
      DOCUMENT_NAME_SOURCE.UPLOAD,
      DOCUMENT_NAME_SOURCE.CUSTOM,
    ]),
    customDocumentName: z.string(),
    customDocumentData: z
      .array(
        z.object({
          title: z.string(),
          data: z.instanceof(File).optional(),
          uploadSequence: z.number().optional(),
          envelopeItemId: z.string(),
        }),
      )
      .optional(),
    recipients: z.array(
      z.object({
        id: z.number(),
        email: ZRecipientEmailSchema,
        name: z.string(),
        signingOrder: z.number().optional(),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.documentNameSource === DOCUMENT_NAME_SOURCE.TEMPLATE) {
      return;
    }

    const title = getTemplateUseDocumentTitle(data);
    const path = data.documentNameSource === DOCUMENT_NAME_SOURCE.CUSTOM ? 'customDocumentName' : 'documentNameSource';

    if (!title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: msg`Document name is required`.id,
        path: [path],
      });

      return;
    }

    if (title.length > DOCUMENT_TITLE_MAX_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: msg`Document name is too long`.id,
        path: [path],
      });
    }
  });

type TAddRecipientsForNewDocumentSchema = z.infer<typeof ZAddRecipientsForNewDocumentSchema>;

export type TemplateUseDialogProps = {
  envelopeId: string;
  templateId: number;
  templateSigningOrder?: DocumentSigningOrder | null;
  recipients: TRecipientLite[];
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
  const uploadSequenceRef = useRef(0);

  const { data: response, isLoading: isLoadingEnvelopeItems } = trpc.envelope.item.getMany.useQuery(
    {
      envelopeId,
    },
    {
      placeholderData: (previousData) => previousData,
      ...SKIP_QUERY_BATCH_META,
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      enabled: open,
    },
  );

  const envelopeItems = response?.data ?? [];

  const generateDefaultFormValues = () => {
    return {
      distributeDocument: false,
      useCustomDocument: false,
      documentNameSource: DOCUMENT_NAME_SOURCE.TEMPLATE,
      customDocumentName: '',
      customDocumentData: envelopeItems.map((item) => ({
        title: item.title,
        data: undefined,
        envelopeItemId: item.id,
      })),
      recipients: recipients
        .sort((a, b) => (a.signingOrder || 0) - (b.signingOrder || 0))
        .map((recipient) => {
          const isRecipientEmailPlaceholder = recipient.email.match(TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX);

          const isRecipientNamePlaceholder = recipient.name.match(TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX);

          return {
            id: recipient.id,
            name: !isRecipientNamePlaceholder ? recipient.name : '',
            email: !isRecipientEmailPlaceholder ? recipient.email : '',
            signingOrder: recipient.signingOrder ?? undefined,
          };
        }),
    };
  };

  const form = useForm<TAddRecipientsForNewDocumentSchema>({
    resolver: zodResolver(ZAddRecipientsForNewDocumentSchema),
    defaultValues: generateDefaultFormValues(),
  });

  const { replace, fields: localCustomDocumentData } = useFieldArray({
    control: form.control,
    name: 'customDocumentData',
  });

  const { mutateAsync: createDocumentFromTemplate } = trpc.template.createDocumentFromTemplate.useMutation();

  const onSubmit = async (data: TAddRecipientsForNewDocumentSchema) => {
    try {
      const documentTitle = getTemplateUseDocumentTitle(data);

      const customFilesToUpload = (data.customDocumentData ?? []).filter(
        (item): item is typeof item & { data: File } => item.data !== undefined,
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
        ...(documentTitle ? { override: { title: documentTitle } } : {}),
      });

      toast({
        title: _(msg`Document created`),
        description: _(msg`Your document has been created from the template successfully.`),
        duration: 5000,
      });

      let documentPath = `${documentRootPath}/${envelopeId}`;

      if (data.distributeDocument && documentDistributionMethod === DocumentDistributionMethod.NONE) {
        documentPath += '?action=view-signing-links';
      }

      await navigate(documentPath);
    } catch (err) {
      const error = AppError.parseError(err);
      const errorMessage = getTemplateUseErrorMessage(error.code);

      toast({
        title: _(errorMessage.title),
        description: _(errorMessage.description),
        variant: 'destructive',
      });
    }
  };

  const { fields: formRecipients } = useFieldArray({
    control: form.control,
    name: 'recipients',
  });

  const useCustomDocument = form.watch('useCustomDocument');
  const documentNameSource = form.watch('documentNameSource');
  const customDocumentData = form.watch('customDocumentData');
  const lastUploadedFile = useCustomDocument ? getLastUploadedFile(customDocumentData) : undefined;
  const canUseUploadedDocumentName = Boolean(lastUploadedFile);

  useEffect(() => {
    if (open) {
      form.reset(generateDefaultFormValues());
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

  useEffect(() => {
    if (documentNameSource !== DOCUMENT_NAME_SOURCE.UPLOAD || canUseUploadedDocumentName) {
      return;
    }

    form.setValue('documentNameSource', DOCUMENT_NAME_SOURCE.TEMPLATE);
    form.clearErrors('documentNameSource');
  }, [canUseUploadedDocumentName, documentNameSource, form]);

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="bg-background">
            <Plus className="mr-2 -ml-1 h-4 w-4" />
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
          <form className="min-w-0" onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset className="flex h-full min-w-0 flex-col" disabled={form.formState.isSubmitting}>
              <div className="custom-scrollbar -m-1 max-h-[60vh] w-full min-w-0 max-w-full space-y-4 overflow-y-auto overflow-x-hidden p-1">
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
                                value={field.value?.toString() || recipients[index]?.signingOrder?.toString()}
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
                              placeholder={recipients[index].name || _(msg`Recipient ${index + 1}`)}
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
                                className="ml-2 flex items-center text-muted-foreground text-sm"
                                htmlFor="distributeDocument"
                              >
                                <Trans>Send document</Trans>
                                <Tooltip>
                                  <TooltipTrigger type="button">
                                    <InfoIcon className="mx-1 h-4 w-4" />
                                  </TooltipTrigger>

                                  <TooltipContent className="z-[99999] max-w-md space-y-2 p-4 text-muted-foreground">
                                    <p>
                                      <Trans>
                                        The document will be immediately sent to recipients if this is checked.
                                      </Trans>
                                    </p>

                                    <p>
                                      <Trans>Otherwise, the document will be created as a draft.</Trans>
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </label>
                            )}

                            {documentDistributionMethod === DocumentDistributionMethod.NONE && (
                              <label
                                className="ml-2 flex items-center text-muted-foreground text-sm"
                                htmlFor="distributeDocument"
                              >
                                <Trans>Create as pending</Trans>
                                <Tooltip>
                                  <TooltipTrigger type="button">
                                    <InfoIcon className="mx-1 h-4 w-4" />
                                  </TooltipTrigger>
                                  <TooltipContent className="z-[99999] max-w-md space-y-2 p-4 text-muted-foreground">
                                    <p>
                                      <Trans>Create the document as pending and ready to sign.</Trans>
                                    </p>

                                    <p>
                                      <Trans>We won't send anything to notify recipients.</Trans>
                                    </p>

                                    <p className="mt-2">
                                      <Trans>
                                        We will generate signing links for you, which you can send to the recipients
                                        through your method of choice.
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
                              const customDocumentData = form.getValues('customDocumentData');

                              form.setValue(
                                'customDocumentData',
                                customDocumentData?.map((item) => ({
                                  ...item,
                                  data: undefined,
                                })),
                              );
                              form.clearErrors('customDocumentData');
                            }
                          }}
                        />
                        <label
                          className="ml-2 flex items-center text-muted-foreground text-sm"
                          htmlFor="useCustomDocument"
                        >
                          <Trans>Upload custom document</Trans>
                          <Tooltip>
                            <TooltipTrigger type="button">
                              <InfoIcon className="mx-1 h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent className="z-[99999] max-w-md space-y-2 p-4 text-muted-foreground">
                              <p>
                                <Trans>
                                  Upload a custom document to use instead of the template's default document
                                </Trans>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </label>
                      </div>
                    </FormItem>
                  )}
                />

                {useCustomDocument && (
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
                                  className="flex w-full min-w-0 items-center gap-4 overflow-hidden rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/10"
                                >
                                  <div className="flex-shrink-0">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                      <FileTextIcon className="h-5 w-5 text-primary" />
                                    </div>
                                  </div>

                                  <div className="min-w-0 flex-1 overflow-hidden">
                                    <h4 className="truncate font-medium text-foreground text-sm">
                                      {field.value ? getUploadedDocumentTitle(field.value) : item.title}
                                    </h4>
                                    <p className="mt-0.5 text-muted-foreground text-xs">
                                      {field.value ? (
                                        <span>
                                          <Trans>Custom {(field.value.size / (1024 * 1024)).toFixed(2)} MB file</Trans>
                                        </span>
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
                                          form.setError(`customDocumentData.${i}.data`, {
                                            type: 'manual',
                                            message: _(msg`Please select a PDF file`),
                                          });

                                          return;
                                        }

                                        if (file.size > APP_DOCUMENT_UPLOAD_SIZE_LIMIT * 1024 * 1024) {
                                          form.setError(`customDocumentData.${i}.data`, {
                                            type: 'manual',
                                            message: _(
                                              msg`File size exceeds the limit of ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT} MB`,
                                            ),
                                          });

                                          return;
                                        }

                                        field.onChange(file);
                                        form.setValue(
                                          `customDocumentData.${i}.uploadSequence`,
                                          ++uploadSequenceRef.current,
                                        );
                                        form.clearErrors(`customDocumentData.${i}.data`);
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

                <FormField
                  control={form.control}
                  name="documentNameSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Document name</Trans>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          aria-label={_(msg`Document name`)}
                          value={field.value}
                          onValueChange={field.onChange}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="document-name-source-template" value={DOCUMENT_NAME_SOURCE.TEMPLATE} />
                            <label className="text-sm" htmlFor="document-name-source-template">
                              <Trans>Use template name</Trans>
                            </label>
                          </div>

                          <div className="flex items-start gap-2">
                            <RadioGroupItem
                              id="document-name-source-upload"
                              value={DOCUMENT_NAME_SOURCE.UPLOAD}
                              disabled={!canUseUploadedDocumentName}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <label
                                  className={cn('text-sm', {
                                    'cursor-not-allowed text-muted-foreground': !canUseUploadedDocumentName,
                                  })}
                                  htmlFor="document-name-source-upload"
                                >
                                  <Trans>Use uploaded file name</Trans>
                                </label>

                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    aria-label={_(msg`About uploaded file naming`)}
                                    className="text-muted-foreground"
                                  >
                                    <InfoIcon className="h-4 w-4" />
                                  </TooltipTrigger>
                                  <TooltipContent className="z-[99999] max-w-xs">
                                    <Trans>
                                      The document name will use the most recently uploaded file name without its
                                      extension.
                                    </Trans>
                                  </TooltipContent>
                                </Tooltip>
                              </div>

                              {lastUploadedFile && (
                                <p
                                  className="max-w-sm truncate text-muted-foreground text-xs"
                                  title={lastUploadedFile.name}
                                >
                                  {lastUploadedFile.name}
                                </p>
                              )}

                              {!canUseUploadedDocumentName && (
                                <p className="text-muted-foreground text-xs">
                                  <Trans>Upload a custom document to use its file name.</Trans>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="document-name-source-custom" value={DOCUMENT_NAME_SOURCE.CUSTOM} />
                            <label className="text-sm" htmlFor="document-name-source-custom">
                              <Trans>Enter custom document name</Trans>
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {documentNameSource === DOCUMENT_NAME_SOURCE.CUSTOM && (
                  <FormField
                    control={form.control}
                    name="customDocumentName"
                    render={({ field }) => (
                      <FormItem className="ml-6">
                        <FormLabel>
                          <Trans>Custom document name</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={_(msg`Enter a document name`)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
