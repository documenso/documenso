import { Trans } from '@lingui/react/macro';
import { AlertTriangleIcon } from 'lucide-react';

export const DirectTemplateInvalidPageView = () => {
  return (
    <div className="mx-auto flex h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div>
        <AlertTriangleIcon className="h-10 w-10 text-destructive" />

        <h1 className="mt-4 font-semibold text-3xl">
          <Trans>Invalid direct link template</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>
            This direct link template cannot be used because one or more signers do not have a signature field assigned.
            Please contact the sender to update the template.
          </Trans>
        </p>
      </div>
    </div>
  );
};
