import signingCelebration from '@documenso/assets/images/signing-celebration.png';
import { SigningCard3D } from '@documenso/ui/components/signing-card';
import { Trans } from '@lingui/react/macro';
import type { Signature } from '@prisma/client';
import { CheckCircle2Icon } from 'lucide-react';

export type EmbedDocumentCompletedPageProps = {
  name?: string;
  signature?: Signature;
};

export const EmbedDocumentCompleted = ({ name, signature }: EmbedDocumentCompletedPageProps) => {
  return (
    <div className="embed--DocumentCompleted relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center overflow-hidden p-6">
      <div className="embed--DocumentCompletedCard w-full max-w-sm md:max-w-md">
        <SigningCard3D
          className="mx-auto w-full"
          name={name || 'Documenso'}
          signature={signature}
          signingCelebrationImage={signingCelebration}
        />
      </div>

      <h2 className="embed--DocumentCompletedTitle mt-8 max-w-[35ch] text-center font-semibold text-2xl text-foreground leading-normal md:text-3xl">
        <Trans>Document Completed</Trans>
      </h2>

      <div className="embed--DocumentCompletedStatus mt-4 flex items-center text-center text-documenso-700">
        <CheckCircle2Icon className="mr-2 h-5 w-5" />
        <span className="text-sm">
          <Trans>No further action is required</Trans>
        </span>
      </div>

      <p className="embed--DocumentCompletedDescription mt-2.5 max-w-[50ch] text-center font-medium text-muted-foreground/60 text-sm md:text-base">
        <Trans>Please follow any instructions provided within the parent application.</Trans>
      </p>
    </div>
  );
};
