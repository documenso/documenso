import { Form, FormControl, FormDescription, FormField } from '@documenso/ui/primitives/form/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import type { TeamGlobalSettings } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormStickySaveBar } from './form-sticky-save-bar';
import { InheritableField } from './inheritable-field';

const ZCertificatePreferencesFormSchema = z.object({
  includeSigningCertificate: z.boolean().nullable(),
  includeAuditLog: z.boolean().nullable(),
});

export type TCertificatePreferencesFormSchema = z.infer<typeof ZCertificatePreferencesFormSchema>;

type SettingsSubset = Pick<TeamGlobalSettings, 'includeSigningCertificate' | 'includeAuditLog'>;

export type CertificatePreferencesFormProps = {
  settings: SettingsSubset;
  canInherit: boolean;
  onFormSubmit: (data: TCertificatePreferencesFormSchema) => Promise<void>;
};

export const CertificatePreferencesForm = ({ settings, canInherit, onFormSubmit }: CertificatePreferencesFormProps) => {
  const form = useForm<TCertificatePreferencesFormSchema>({
    defaultValues: {
      includeSigningCertificate: settings.includeSigningCertificate,
      includeAuditLog: settings.includeAuditLog,
    },
    resolver: zodResolver(ZCertificatePreferencesFormSchema),
  });

  const handleFormSubmit = form.handleSubmit(async (data) => {
    try {
      await onFormSubmit(data);
    } catch {
      // The page handler surfaces its own error toast. Keep the form dirty so
      // the save bar stays visible and the user can retry.
      return;
    }

    form.reset(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit}>
        <fieldset className="flex h-full flex-col gap-y-6" disabled={form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="includeSigningCertificate"
            render={({ field }) => (
              <InheritableField
                className="flex-1"
                canInherit={canInherit}
                isInherited={field.value === null}
                label={<Trans>Include the Signing Certificate in the Document</Trans>}
                testId="include-signing-certificate"
              >
                <FormControl>
                  <Select
                    {...field}
                    value={field.value === null ? '-1' : field.value.toString()}
                    onValueChange={(value) =>
                      field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                    }
                  >
                    <SelectTrigger
                      className="bg-background text-muted-foreground"
                      data-testid="include-signing-certificate-trigger"
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="true">
                        <Trans>Yes</Trans>
                      </SelectItem>

                      <SelectItem value="false">
                        <Trans>No</Trans>
                      </SelectItem>

                      {canInherit && (
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls whether the signing certificate will be included in the document when it is downloaded. The
                    signing certificate can still be downloaded from the logs page separately.
                  </Trans>
                </FormDescription>
              </InheritableField>
            )}
          />

          <FormField
            control={form.control}
            name="includeAuditLog"
            render={({ field }) => (
              <InheritableField
                className="flex-1"
                canInherit={canInherit}
                isInherited={field.value === null}
                label={<Trans>Include the Audit Logs in the Document</Trans>}
                testId="include-audit-log"
              >
                <FormControl>
                  <Select
                    {...field}
                    value={field.value === null ? '-1' : field.value.toString()}
                    onValueChange={(value) =>
                      field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                    }
                  >
                    <SelectTrigger
                      className="bg-background text-muted-foreground"
                      data-testid="include-audit-log-trigger"
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="true">
                        <Trans>Yes</Trans>
                      </SelectItem>

                      <SelectItem value="false">
                        <Trans>No</Trans>
                      </SelectItem>

                      {canInherit && (
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls whether the audit logs will be included in the document when it is downloaded. The audit
                    logs can still be downloaded from the logs page separately.
                  </Trans>
                </FormDescription>
              </InheritableField>
            )}
          />

          <FormStickySaveBar
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
            onReset={() => form.reset()}
          />
        </fieldset>
      </form>
    </Form>
  );
};
