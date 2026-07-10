import { DOCUMENT_TITLE_MAX_LENGTH } from '@documenso/trpc/server/document-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';

export const DOCUMENT_NAME_SOURCE = {
  TEMPLATE: 'template',
  UPLOAD: 'upload',
  CUSTOM: 'custom',
} as const;

type TDocumentNameSource = (typeof DOCUMENT_NAME_SOURCE)[keyof typeof DOCUMENT_NAME_SOURCE];

type TTemplateUseCustomDocumentData = {
  data?: File;
};

type TTemplateUseDocumentNameData = {
  documentNameSource: TDocumentNameSource;
  customDocumentName: string;
  customDocumentData?: TTemplateUseCustomDocumentData[];
};

type TTemplateUseDocumentNameFormValues = TTemplateUseDocumentNameData & {
  useCustomDocument: boolean;
};

const getUploadedDocumentTitle = (customDocumentData?: TTemplateUseCustomDocumentData[]) => {
  const uploadedFiles = customDocumentData?.map((item) => item.data).filter((file): file is File => file !== undefined);

  if (uploadedFiles?.length !== 1) {
    return undefined;
  }

  return uploadedFiles[0].name.replace(/\.[^/.]+$/, '').trim();
};

export const getTemplateUseDocumentTitle = (data: TTemplateUseDocumentNameData) => {
  if (data.documentNameSource === DOCUMENT_NAME_SOURCE.UPLOAD) {
    return getUploadedDocumentTitle(data.customDocumentData);
  }

  if (data.documentNameSource === DOCUMENT_NAME_SOURCE.CUSTOM) {
    return data.customDocumentName.trim();
  }

  return undefined;
};

export const refineTemplateUseDocumentName = (data: TTemplateUseDocumentNameData, ctx: z.RefinementCtx) => {
  if (data.documentNameSource === DOCUMENT_NAME_SOURCE.TEMPLATE) {
    return;
  }

  const title = getTemplateUseDocumentTitle(data);
  const path = data.documentNameSource === DOCUMENT_NAME_SOURCE.CUSTOM ? 'customDocumentName' : 'documentNameSource';

  if (!title) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        data.documentNameSource === DOCUMENT_NAME_SOURCE.CUSTOM
          ? msg`Document name is required`.id
          : msg`Select exactly one uploaded document to use its file name.`.id,
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
};

export const TemplateUseDialogDocumentName = () => {
  const { t } = useLingui();
  const { clearErrors, control, setValue } = useFormContext<TTemplateUseDocumentNameFormValues>();
  const [useCustomDocument, documentNameSource, customDocumentData] = useWatch({
    control,
    name: ['useCustomDocument', 'documentNameSource', 'customDocumentData'],
  });

  const uploadedDocumentCount = customDocumentData?.filter((item) => item.data !== undefined).length ?? 0;
  const canUseUploadedDocumentName = useCustomDocument && uploadedDocumentCount === 1;

  useEffect(() => {
    if (documentNameSource !== DOCUMENT_NAME_SOURCE.UPLOAD || canUseUploadedDocumentName) {
      return;
    }

    setValue('documentNameSource', DOCUMENT_NAME_SOURCE.TEMPLATE);
    clearErrors('documentNameSource');
  }, [canUseUploadedDocumentName, clearErrors, documentNameSource, setValue]);

  return (
    <>
      <FormField
        control={control}
        name="documentNameSource"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <Trans>Document name</Trans>
            </FormLabel>
            <FormControl>
              <RadioGroup
                aria-label={t`Document name`}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);

                  if (value !== DOCUMENT_NAME_SOURCE.CUSTOM) {
                    clearErrors('customDocumentName');
                  }

                  if (value !== DOCUMENT_NAME_SOURCE.UPLOAD) {
                    clearErrors('documentNameSource');
                  }
                }}
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
                  <div>
                    <label
                      className={cn('text-sm', {
                        'cursor-not-allowed text-muted-foreground': !canUseUploadedDocumentName,
                      })}
                      htmlFor="document-name-source-upload"
                    >
                      <Trans>Use uploaded file name</Trans>
                    </label>

                    {!canUseUploadedDocumentName && (
                      <p className="text-muted-foreground text-xs">
                        <Trans>Select exactly one uploaded document to use its file name.</Trans>
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
          control={control}
          name="customDocumentName"
          render={({ field }) => (
            <FormItem className="ml-6">
              <FormLabel>
                <Trans>Custom document name</Trans>
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t`Enter a document name`} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
};
