import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

export const EmbedSenderDisabled = () => {
  const [hasPostedMessage, setHasPostedMessage] = useState(false);

  useEffect(() => {
    if (window.parent && !hasPostedMessage) {
      window.parent.postMessage(
        {
          action: 'sender-disabled',
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
    <div className="embed--SenderDisabled relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
      <h3 className="text-center font-bold text-2xl text-foreground">
        <Trans>Sender Account Disabled</Trans>
      </h3>

      <div className="mt-8 max-w-[50ch] text-center">
        <p className="text-muted-foreground text-sm">
          <Trans>
            This document is no longer available to sign because the account that sent it has been disabled, likely due
            to spam or abuse.
          </Trans>
        </p>

        <p className="mt-4 text-muted-foreground text-sm">
          <Trans>Please check with the parent application for more information.</Trans>
        </p>
      </div>
    </div>
  );
};
