import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';

export const EmbedDocumentWaitingForTurn = () => {
  const [hasPostedMessage, setHasPostedMessage] = useState(false);

  useEffect(() => {
    if (window.parent && !hasPostedMessage) {
      window.parent.postMessage(
        {
          action: 'document-waiting-for-turn',
          data: null,
        },
        '*',
      );
    }

    setHasPostedMessage(true);
  }, [hasPostedMessage]);

  if (!hasPostedMessage) {
    return null;
  }

  return (
    <div className="embed--WaitingForTurn relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
      <h3 className="text-foreground text-center text-2xl font-bold">
        <Trans>Waiting for Your Turn</Trans>
      </h3>

      <div className="mt-8 max-w-[50ch] text-center">
        <p className="text-muted-foreground text-sm">
          <Trans>
            It's currently not your turn to sign. Please check back soon as this document should be
            available for you to sign shortly.
          </Trans>
        </p>

        <p className="text-muted-foreground mt-4 text-sm">
          <Trans>Please check with the parent application for more information.</Trans>
        </p>
      </div>
    </div>
  );
};
