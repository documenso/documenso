import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TBulkSendCsvError } from '@documenso/lib/server-only/template/validate-bulk-send-csv';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Form, FormControl, FormField, FormItem } from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { File as FileIcon, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { useCurrentTeam } from '~/providers/team';

const ZBulkSendFormSchema = z.object({
  file: z.instanceof(File),
  sendImmediately: z.boolean().default(false),
});

type TBulkSendFormSchema = z.infer<typeof ZBulkSendFormSchema>;

type TBulkSendValidationError = TBulkSendCsvError | { type: 'UPLOAD_ERROR'; code: string };

export type TemplateBulkSendDialogProps = {
  templateId: number;
  recipients: Array<{ email: string; name?: string | null }>;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
};

export const TemplateBulkSendDialog = ({ templateId, recipients, trigger, onSuccess }: TemplateBulkSendDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const team = useCurrentTeam();

  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState<TBulkSendValidationError | null>(null);

  const form = useForm<TBulkSendFormSchema>({
    resolver: zodResolver(ZBulkSendFormSchema),
    defaultValues: {
      sendImmediately: false,
    },
  });

  const { mutateAsync: uploadBulkSend } = trpc.template.uploadBulkSend.useMutation();

  const onOpenChange = (value: boolean) => {
    if (form.formState.isSubmitting) {
      return;
    }

    setOpen(value);

    if (!value) {
      setValidationError(null);

      form.reset();
    }
  };

  const onDownloadTemplate = () => {
    const headers = recipients.flatMap((_, index) => [`recipient_${index + 1}_email`, `recipient_${index + 1}_name`]);

    const exampleRow = recipients.flatMap((recipient) => [recipient.email, recipient.name || '']);

    const csv = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'template.csv',
    });

    a.click();

    window.URL.revokeObjectURL(url);
  };

  const onSubmit = async (values: TBulkSendFormSchema) => {
    setValidationError(null);

    try {
      const csv = await values.file.text();

      const result = await uploadBulkSend({
        templateId,
        teamId: team?.id,
        csv: csv,
        sendImmediately: values.sendImmediately,
      });

      if (!result.success) {
        setValidationError(result.error);

        return;
      }

      toast({
        title: _(msg`Success`),
        description: _(msg`Your bulk send has been initiated. You will receive an email notification upon completion.`),
      });

      setOpen(false);
      form.reset();

      onSuccess?.();
    } catch (err) {
      console.error(err);

      const error = AppError.parseError(err);

      setValidationError({ type: 'UPLOAD_ERROR', code: error.code });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="shrink-0" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            <Trans>Bulk Send via CSV</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Bulk Send Template via CSV</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Upload a CSV file to create multiple documents from this template. Each row represents one document with
              its recipient details.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
            <div className="rounded-lg border bg-muted/70 p-4">
              <h3 className="font-medium text-sm">
                <Trans>CSV Structure</Trans>
              </h3>

              <p className="mt-1 text-muted-foreground text-sm">
                <Trans>
                  For each recipient, provide their email (required) and name (optional) in separate columns. Download
                  the template CSV below for the correct format.
                </Trans>
              </p>

              <p className="mt-4 text-sm">
                <Trans>Current recipients:</Trans>
              </p>

              <ul className="mt-2 list-inside list-disc text-muted-foreground text-sm">
                {recipients.map((recipient, index) => (
                  <li key={index}>{recipient.name ? `${recipient.name} (${recipient.email})` : recipient.email}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-y-2">
              <Button onClick={onDownloadTemplate} variant="outline" type="button">
                <Trans>Download Template CSV</Trans>
              </Button>

              <p className="text-muted-foreground text-xs">
                <Trans>Pre-formatted CSV template with example data.</Trans>
              </p>
            </div>

            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <FormItem>
                  <FormControl>
                    {!value ? (
                      <Button asChild variant="outline" className="w-full">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];

                              if (file) {
                                setValidationError(null);

                                onChange(file);
                              }
                            }}
                            disabled={form.formState.isSubmitting}
                          />
                          <Upload className="mr-2 h-4 w-4" />
                          <Trans>Upload CSV</Trans>
                        </label>
                      </Button>
                    ) : (
                      <div className="flex h-10 items-center rounded-md border px-3">
                        <div className="flex flex-1 items-center gap-2">
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate text-sm">{value.name}</span>
                        </div>

                        <Button
                          type="button"
                          variant="link"
                          className="p-0 text-destructive text-xs hover:text-destructive"
                          onClick={() => {
                            setValidationError(null);

                            form.resetField('file');
                          }}
                          disabled={form.formState.isSubmitting}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">
                            <Trans>Remove</Trans>
                          </span>
                        </Button>
                      </div>
                    )}
                  </FormControl>

                  {error && <p className="text-destructive text-sm">{error.message}</p>}

                  <p className="text-muted-foreground text-xs">
                    <Trans>
                      Maximum file size: 4MB. Maximum 100 rows per upload. Blank values will use template defaults.
                    </Trans>
                  </p>
                </FormItem>
              )}
            />

            {validationError !== null && (
              <Alert variant="destructive">
                <AlertDescription className="max-h-32 overflow-y-auto">
                  {match(validationError)
                    .with({ type: 'PARSE_ERROR' }, () => (
                      <Trans>The CSV could not be parsed. Please check the file format and try again.</Trans>
                    ))
                    .with({ type: 'EMPTY' }, () => (
                      <Trans>
                        The CSV does not contain any rows. Please add at least one row of recipient details.
                      </Trans>
                    ))
                    .with({ type: 'ROW_LIMIT_EXCEEDED' }, ({ rowCount, maxRows }) => (
                      <Trans>
                        The CSV contains {rowCount} rows. A maximum of {maxRows} rows is allowed per upload.
                      </Trans>
                    ))
                    .with({ type: 'MISSING_COLUMNS' }, ({ missingColumns }) => (
                      <>
                        <Trans>
                          The CSV is missing the following required columns. Please download the template CSV for the
                          correct format.
                        </Trans>

                        <ul className="mt-1 list-inside list-disc">
                          {missingColumns.map((column) => (
                            <li key={column} className="font-mono">
                              {column}
                            </li>
                          ))}
                        </ul>
                      </>
                    ))
                    .with({ type: 'INVALID_RECIPIENTS' }, ({ rowErrors }) => (
                      <>
                        <Trans>The CSV contains invalid recipient emails. Please fix the following rows:</Trans>

                        <ul className="mt-1 list-inside list-disc">
                          {rowErrors.map((rowError, index) => (
                            <li key={index}>
                              <Trans>
                                Row {rowError.row}: <span className="font-mono">{rowError.column}</span> must be a valid
                                email or empty
                              </Trans>
                            </li>
                          ))}
                        </ul>
                      </>
                    ))
                    .with({ type: 'UPLOAD_ERROR' }, ({ code }) =>
                      code === AppErrorCode.LIMIT_EXCEEDED ? (
                        <Trans>The CSV exceeds the maximum file size.</Trans>
                      ) : (
                        <Trans>Failed to upload CSV. Please check the file format and try again.</Trans>
                      ),
                    )
                    .exhaustive()}
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="sendImmediately"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <div className="flex items-center">
                      <Checkbox id="send-immediately" checked={field.value} onCheckedChange={field.onChange} />

                      <label
                        htmlFor="send-immediately"
                        className="ml-2 flex items-center text-muted-foreground text-sm"
                      >
                        <Trans>Send documents to recipients immediately</Trans>
                      </label>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="mt-4">
              <Button variant="secondary" onClick={() => onOpenChange(false)} type="button">
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={form.formState.isSubmitting}>
                <Trans>Upload and Process</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
