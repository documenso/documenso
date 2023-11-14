'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import signingCelebration from '@documenso/assets/images/signing-celebration.png';
import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { DocumentStatus, Signature } from '@documenso/prisma/client';
import { DocumentWithRecipient } from '@documenso/prisma/types/document-with-recipient';
import DocumentDialog from '@documenso/ui/components/document/document-dialog';
import { DocumentDownloadButton } from '@documenso/ui/components/document/document-download-button';
import { DocumentShareButton } from '@documenso/ui/components/document/document-share-button';
import { SigningCard3D } from '@documenso/ui/components/signing-card';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { ConfettiScreen } from '~/components/(marketing)/confetti-screen';

interface SinglePlayerModeSuccessProps {
  className?: string;
  locale: LocaleTypes;
  document: DocumentWithRecipient;
  signatures: Signature[];
}

export const SinglePlayerModeSuccess = ({
  className,
  document,
  signatures,
  locale,
}: SinglePlayerModeSuccessProps) => {
  const { getFlag } = useFeatureFlags();
  const { t } = useTranslation(locale, 'marketing');

  const isConfettiEnabled = getFlag('marketing_spm_confetti');

  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

  const { documentData } = document;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center sm:min-h-[calc(100vh-13rem)]">
      {isConfettiEnabled && (
        <ConfettiScreen duration={3000} gravity={0.075} initialVelocityY={50} wind={0.005} />
      )}

      <h2 className="relative z-10 text-center text-2xl font-semibold leading-normal md:text-3xl lg:mb-2 lg:text-4xl">
        {t(`you-have-signed`)}
        <span className="mt-2 block">{document.title}</span>
      </h2>

      <SigningCard3D
        className="mt-8"
        name={document.Recipient.name || document.Recipient.email}
        signature={signatures.at(0)}
        signingCelebrationImage={signingCelebration}
      />

      <div className="relative mt-8 w-full">
        <div className={cn('flex flex-col items-center', className)}>
          <div className="grid w-full max-w-sm grid-cols-2 gap-4">
            <DocumentShareButton
              documentId={document.id}
              token={document.Recipient.token}
              className="flex-1 bg-transparent backdrop-blur-sm"
            />

            <DocumentDownloadButton
              className="flex-1 bg-transparent backdrop-blur-sm"
              fileName={document.title}
              documentData={document.documentData}
              disabled={document.status !== DocumentStatus.COMPLETED}
            />

            <Button onClick={() => setShowDocumentDialog(true)} className="z-10 col-span-2">
              {t(`show-document`)}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground/60 mt-16 text-center text-sm">
        {t(`create-a`)}{' '}
        <Link
          href={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/signup`}
          target="_blank"
          className="text-documenso-700 hover:text-documenso-600 whitespace-nowrap"
        >
          {t(`free account`)}
        </Link>{' '}
        {t(`access-your-doc`)}
      </p>

      <DocumentDialog
        documentData={documentData}
        open={showDocumentDialog}
        onOpenChange={setShowDocumentDialog}
      />
    </div>
  );
};
