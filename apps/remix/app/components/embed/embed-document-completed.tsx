import { Trans } from '@lingui/react/macro';
import type { Signature } from '@prisma/client';

import signingCelebration from '@documenso/assets/images/signing-celebration.png';
import { SigningCard3D } from '@documenso/ui/components/signing-card';

export type EmbedDocumentCompletedPageProps = {
  name?: string;
  signature?: Signature;
};

export const EmbedDocumentCompleted = ({ name, signature }: EmbedDocumentCompletedPageProps) => {
  return (
    <div className="embed--DocumentCompleted relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
      <h3 className="text-foreground text-2xl font-semibold">
        <Trans>Document Completed!</Trans>
      </h3>

      <div className="mt-8 w-full max-w-md">
        <SigningCard3D
          className="mx-auto w-full"
          name={name || 'Documenso'}
          signature={signature}
          signingCelebrationImage={signingCelebration}
        />
      </div>

      <p className="text-muted-foreground mt-8 max-w-[50ch] text-center text-sm">
        <Trans>
          The document is now completed, please follow any instructions provided within the parent
          application.
        </Trans>
      </p>
    </div>
  );
};
