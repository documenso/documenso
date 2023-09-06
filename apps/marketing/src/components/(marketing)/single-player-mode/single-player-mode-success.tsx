'use client';

import { useState } from 'react';

import { Share } from 'lucide-react';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { DocumentWithRecipient } from '@documenso/prisma/types/document-with-recipient';
import DocumentDialog from '@documenso/ui/components/document/document-dialog';
import { DocumentDownloadButton } from '@documenso/ui/components/document/document-download-button';
import { SigningCard3D } from '@documenso/ui/components/signing-card';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import signingCelebration from '~/assets/signing-celebration.png';
import ConfettiScreen from '~/components/(marketing)/confetti-screen';

import { DocumentStatus } from '.prisma/client';

interface SinglePlayerModeSuccessProps {
  className?: string;
  document: DocumentWithRecipient;
}

export default function SinglePlayerModeSuccess({
  className,
  document,
}: SinglePlayerModeSuccessProps) {
  const [showDocument, setShowDocument] = useState(false);
  const isMounted = useIsMounted();

  if (isMounted) {
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="flex min-h-[calc(100vh-13rem)] flex-col items-center justify-center">
      <ConfettiScreen duration={3000} gravity={0.075} initialVelocityY={50} wind={0.005} />

      <h2 className="mb-6 max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
        You have signed "{document.title}"
      </h2>

      <SigningCard3D
        name={document.Recipient.name || document.Recipient.email}
        signingCelebrationImage={signingCelebration}
      />

      <div className="mt-8 w-full">
        <div className={cn('flex flex-col items-center', className)}>
          <div className="grid w-full max-w-sm grid-cols-2 gap-4">
            {/* TODO: Hook this up */}
            <Button variant="outline" className="flex-1" disabled>
              <Share className="mr-2 h-5 w-5" />
              Share
            </Button>

            <DocumentDownloadButton
              className="flex-1"
              fileName={document.title}
              document={document.document}
              disabled={document.status !== DocumentStatus.COMPLETED}
            />

            <Button onClick={() => setShowDocument(true)} className="col-span-2">
              Show document
            </Button>
          </div>
        </div>
      </div>

      <DocumentDialog
        document={document.document}
        open={showDocument}
        onOpenChange={setShowDocument}
      />
    </div>
  );
}
