import { Trans } from '@lingui/react/macro';
import { XCircle } from 'lucide-react';

export const EmbedDocumentRejected = () => {
  return (
    <div className="embed--DocumentRejected relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-x-4">
          <XCircle className="text-destructive h-10 w-10" />

          <h2 className="max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
            <Trans>Document Rejected</Trans>
          </h2>
        </div>

        <div className="text-destructive mt-4 flex items-center text-center text-sm">
          <Trans>You have rejected this document</Trans>
        </div>

        <p className="text-muted-foreground mt-6 max-w-[60ch] text-center text-sm">
          <Trans>
            The document owner has been notified of your decision. They may contact you with further
            instructions if necessary.
          </Trans>
        </p>

        <p className="text-muted-foreground mt-2 max-w-[60ch] text-center text-sm">
          <Trans>No further action is required from you at this time.</Trans>
        </p>
      </div>
    </div>
  );
};
