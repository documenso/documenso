import { Trans } from '@lingui/react/macro';

import { Spinner } from '@documenso/ui/primitives/spinner';

export const PdfViewerLoadingState = () => {
  return (
    <div className="flex h-[80vh] max-h-[60rem] w-full flex-col items-center justify-center overflow-hidden">
      <Spinner />
    </div>
  );
};

export const PdfViewerErrorState = () => {
  return (
    <div className="flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50 dark:bg-background">
      <div className="text-center text-muted-foreground">
        <p>
          <Trans>Something went wrong while loading the document.</Trans>
        </p>
        <p className="mt-1 text-sm">
          <Trans>Please try again or contact our support.</Trans>
        </p>
      </div>
    </div>
  );
};
