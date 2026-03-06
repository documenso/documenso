import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';

export const EmbedRecipientExpired = () => {
  const [hasPostedMessage, setHasPostedMessage] = useState(false);

  useEffect(() => {
    if (window.parent && !hasPostedMessage) {
      window.parent.postMessage(
        {
          action: 'recipient-expired',
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
    <div className="embed--RecipientExpired relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
      <h3 className="text-center text-2xl font-bold text-foreground">
        <Trans>Signing Window Expired</Trans>
      </h3>

      <div className="mt-8 max-w-[50ch] text-center">
        <p className="text-sm text-muted-foreground">
          <Trans>
            Your signing window for this document has expired. Please contact the sender for a new
            invitation.
          </Trans>
        </p>

        <p className="mt-4 text-sm text-muted-foreground">
          <Trans>Please check with the parent application for more information.</Trans>
        </p>
      </div>
    </div>
  );
};
