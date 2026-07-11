import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { getRecipientsWithMissingFields } from '@documenso/lib/utils/recipients';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';

export type EnvelopeEditorInvalidDirectTemplateAlertProps = {
  className?: string;
};

/**
 * Warns that a direct link template cannot be used because one or more signers
 * are missing a signature field.
 */
export const EnvelopeEditorInvalidDirectTemplateAlert = ({
  className,
}: EnvelopeEditorInvalidDirectTemplateAlertProps) => {
  const { envelope, isTemplate } = useCurrentEnvelopeEditor();

  const signersMissingSignatureFields = useMemo(() => {
    if (!isTemplate || !envelope.directLink?.enabled) {
      return [];
    }

    return getRecipientsWithMissingFields(envelope.recipients, envelope.fields);
  }, [isTemplate, envelope.directLink, envelope.recipients, envelope.fields]);

  if (signersMissingSignatureFields.length === 0) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className={cn('mx-auto w-full max-w-[800px] flex-row items-start gap-3 rounded-sm', className)}
    >
      <AlertTitle>
        <Trans>Invalid direct link template</Trans>
      </AlertTitle>

      <AlertDescription>
        <Trans>
          Recipients cannot use this direct link template because the following signers are missing a signature field
        </Trans>

        <ul className="list-disc pl-5">
          {signersMissingSignatureFields.map((recipient, i) => (
            <li key={i}>{recipient.email || recipient.name || `Recipient ${i + 1}`}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};
