import { Trans } from '@lingui/react/macro';
import { AlertTriangleIcon } from 'lucide-react';
import { match } from 'ts-pattern';

/**
 * Why a direct link template cannot be used. Each reason would otherwise only
 * surface once the signer submits, since the template renders normally.
 */
export type DirectTemplateInvalidReason = 'MISSING_SIGNATURE_FIELD' | 'MISSING_CONTENT_IMAGE';

export type DirectTemplateInvalidPageViewProps = {
  reason: DirectTemplateInvalidReason;
};

export const DirectTemplateInvalidPageView = ({ reason }: DirectTemplateInvalidPageViewProps) => {
  return (
    <div className="mx-auto flex h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div>
        <AlertTriangleIcon className="h-10 w-10 text-destructive" />

        <h1 className="mt-4 font-semibold text-3xl">
          <Trans>Invalid direct link template</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground text-sm">
          {match(reason)
            .with('MISSING_SIGNATURE_FIELD', () => (
              <Trans>
                This direct link template cannot be used because one or more signers do not have a signature field
                assigned. Please contact the sender to update the template.
              </Trans>
            ))
            .with('MISSING_CONTENT_IMAGE', () => (
              <Trans>
                This direct link template cannot be used because one or more image contents have no image attached.
                Please contact the sender to update the template.
              </Trans>
            ))
            .exhaustive()}
        </p>
      </div>
    </div>
  );
};
