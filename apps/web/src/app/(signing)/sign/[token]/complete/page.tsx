import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CheckCircle2, Clock8 } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { match } from 'ts-pattern';

import signingCelebration from '@documenso/assets/images/signing-celebration.png';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientSignatures } from '@documenso/lib/server-only/recipient/get-recipient-signatures';
import { DocumentStatus, FieldType, RecipientRole } from '@documenso/prisma/client';
import { DocumentDownloadButton } from '@documenso/ui/components/document/document-download-button';
import { DocumentShareButton } from '@documenso/ui/components/document/document-share-button';
import { SigningCard3D } from '@documenso/ui/components/signing-card';

import { truncateTitle } from '~/helpers/truncate-title';

import { DocumentPreviewButton } from './document-preview-button';

export type CompletedSigningPageProps = {
  params: {
    token?: string;
  };
};

export default async function CompletedSigningPage({
  params: { token },
}: CompletedSigningPageProps) {
  if (!token) {
    return notFound();
  }

  const document = await getDocumentAndSenderByToken({
    token,
  }).catch(() => null);

  if (!document || !document.documentData) {
    return notFound();
  }

  const truncatedTitle = truncateTitle(document.title);

  const { documentData } = document;

  const [fields, recipient] = await Promise.all([
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!recipient) {
    return notFound();
  }

  const signatures = await getRecipientSignatures({ recipientId: recipient.id });

  const recipientName =
    recipient.name ||
    fields.find((field) => field.type === FieldType.NAME)?.customText ||
    recipient.email;

  const sessionData = await getServerSession();
  const isLoggedIn = !!sessionData?.user;

  return (
    <div className="-mx-4 flex max-w-[100vw] flex-col items-center overflow-x-hidden px-4 pt-24 md:-mx-8 md:px-8 lg:pt-36 xl:pt-44">
      {/* Card with recipient */}
      <SigningCard3D
        name={recipientName}
        signature={signatures.at(0)}
        signingCelebrationImage={signingCelebration}
      />

      <div className="relative mt-6 flex w-full flex-col items-center">
        {match({ status: document.status, deletedAt: document.deletedAt })
          .with({ status: DocumentStatus.COMPLETED }, () => (
            <div className="text-documenso-700 flex items-center text-center">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              <span className="text-sm">Everyone has signed</span>
            </div>
          ))
          .with({ deletedAt: null }, () => (
            <div className="flex items-center text-center text-blue-600">
              <Clock8 className="mr-2 h-5 w-5" />
              <span className="text-sm">Waiting for others to sign</span>
            </div>
          ))
          .otherwise(() => (
            <div className="flex items-center text-center text-red-600">
              <Clock8 className="mr-2 h-5 w-5" />
              <span className="text-sm">Document no longer available to sign</span>
            </div>
          ))}

        <h2 className="mt-6 max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
          You have
          {recipient.role === RecipientRole.SIGNER && ' signed '}
          {recipient.role === RecipientRole.VIEWER && ' viewed '}
          {recipient.role === RecipientRole.APPROVER && ' approved '}
          <span className="mt-1.5 block">"{truncatedTitle}"</span>
        </h2>

        {match({ status: document.status, deletedAt: document.deletedAt })
          .with({ status: DocumentStatus.COMPLETED }, () => (
            <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
              Everyone has signed! You will receive an Email copy of the signed document.
            </p>
          ))
          .with({ deletedAt: null }, () => (
            <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
              You will receive an Email copy of the signed document once everyone has signed.
            </p>
          ))
          .otherwise(() => (
            <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
              This document has been cancelled by the owner and is no longer available for others to
              sign.
            </p>
          ))}

        <div className="mt-8 flex w-full max-w-sm items-center justify-center gap-4">
          <DocumentShareButton documentId={document.id} token={recipient.token} />

          {document.status === DocumentStatus.COMPLETED ? (
            <DocumentDownloadButton
              className="flex-1"
              fileName={document.title}
              documentData={documentData}
              disabled={document.status !== DocumentStatus.COMPLETED}
            />
          ) : (
            <DocumentPreviewButton
              className="text-[11px]"
              title="Signatures will appear once the document has been completed"
              documentData={documentData}
            />
          )}
        </div>

        {isLoggedIn ? (
          <Link href="/documents" className="text-documenso-700 hover:text-documenso-600 mt-36">
            Go Back Home
          </Link>
        ) : (
          <p className="text-muted-foreground/60 mt-36 text-sm">
            Want to send slick signing links like this one?{' '}
            <Link
              href="https://documenso.com"
              className="text-documenso-700 hover:text-documenso-600"
            >
              Check out Documenso.
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
