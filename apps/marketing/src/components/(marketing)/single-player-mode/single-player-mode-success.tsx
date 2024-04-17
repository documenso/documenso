'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

<<<<<<< HEAD
import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { base64 } from '@documenso/lib/universal/base64';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { DocumentWithRecipient } from '@documenso/prisma/types/document-with-recipient';
=======
import signingCelebration from '@documenso/assets/images/signing-celebration.png';
import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import type { Signature } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';
import type { DocumentWithRecipient } from '@documenso/prisma/types/document-with-recipient';
>>>>>>> main
import DocumentDialog from '@documenso/ui/components/document/document-dialog';
import { DocumentDownloadButton } from '@documenso/ui/components/document/document-download-button';
import { DocumentShareButton } from '@documenso/ui/components/document/document-share-button';
import { SigningCard3D } from '@documenso/ui/components/signing-card';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
<<<<<<< HEAD
import { useToast } from '@documenso/ui/primitives/use-toast';

import signingCelebration from '~/assets/signing-celebration.png';
import ConfettiScreen from '~/components/(marketing)/confetti-screen';

import { DocumentStatus } from '.prisma/client';
=======

import { ConfettiScreen } from '~/components/(marketing)/confetti-screen';
>>>>>>> main

interface SinglePlayerModeSuccessProps {
  className?: string;
  document: DocumentWithRecipient;
<<<<<<< HEAD
}

export const SinglePlayerModeSuccess = ({ className, document }: SinglePlayerModeSuccessProps) => {
=======
  signatures: Signature[];
}

export const SinglePlayerModeSuccess = ({
  className,
  document,
  signatures,
}: SinglePlayerModeSuccessProps) => {
>>>>>>> main
  const { getFlag } = useFeatureFlags();

  const isConfettiEnabled = getFlag('marketing_spm_confetti');

  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
<<<<<<< HEAD
  const [isFetchingDocumentFile, setIsFetchingDocumentFile] = useState(false);
  const [documentFile, setDocumentFile] = useState<string | null>(null);

  const { toast } = useToast();

  const onShowDocumentClick = async () => {
    if (isFetchingDocumentFile) {
      return;
    }

    setIsFetchingDocumentFile(true);

    try {
      const data = await getFile(document.documentData);

      setDocumentFile(base64.encode(data));

      setShowDocumentDialog(true);
    } catch {
      toast({
        title: 'Something went wrong.',
        description: 'We were unable to retrieve the document at this time. Please try again.',
        variant: 'destructive',
        duration: 7500,
      });
    }

    setIsFetchingDocumentFile(false);
  };
=======

  const { documentData } = document;
>>>>>>> main

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center sm:min-h-[calc(100vh-13rem)]">
      {isConfettiEnabled && (
        <ConfettiScreen duration={3000} gravity={0.075} initialVelocityY={50} wind={0.005} />
      )}

      <h2 className="relative z-10 text-center text-2xl font-semibold leading-normal md:text-3xl lg:mb-2 lg:text-4xl">
        You have signed
        <span className="mt-2 block">{document.title}</span>
      </h2>

      <SigningCard3D
        className="mt-8"
<<<<<<< HEAD
        name={document.Recipient.name || document.Recipient.email}
=======
        name={document.Recipient[0].name || document.Recipient[0].email}
        signature={signatures.at(0)}
>>>>>>> main
        signingCelebrationImage={signingCelebration}
      />

      <div className="relative mt-8 w-full">
        <div className={cn('flex flex-col items-center', className)}>
          <div className="grid w-full max-w-sm grid-cols-2 gap-4">
            <DocumentShareButton
              documentId={document.id}
<<<<<<< HEAD
              token={document.Recipient.token}
=======
              token={document.Recipient[0].token}
>>>>>>> main
              className="flex-1 bg-transparent backdrop-blur-sm"
            />

            <DocumentDownloadButton
              className="flex-1 bg-transparent backdrop-blur-sm"
              fileName={document.title}
              documentData={document.documentData}
              disabled={document.status !== DocumentStatus.COMPLETED}
            />

<<<<<<< HEAD
            <Button
              onClick={async () => onShowDocumentClick()}
              loading={isFetchingDocumentFile}
              className="z-10 col-span-2"
            >
=======
            <Button onClick={() => setShowDocumentDialog(true)} className="z-10 col-span-2">
>>>>>>> main
              Show document
            </Button>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground/60 mt-16 text-center text-sm">
        Create a{' '}
        <Link
<<<<<<< HEAD
          href={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/signup`}
=======
          href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=singleplayer`}
>>>>>>> main
          target="_blank"
          className="text-documenso-700 hover:text-documenso-600 whitespace-nowrap"
        >
          free account
        </Link>{' '}
        to access your signed documents at any time
      </p>

      <DocumentDialog
<<<<<<< HEAD
        document={documentFile ?? ''}
=======
        documentData={documentData}
>>>>>>> main
        open={showDocumentDialog}
        onOpenChange={setShowDocumentDialog}
      />
    </div>
  );
};
